/**
 * lib/flightdeck — a DROP-IN replacement for Vercel Next.js Commerce's
 * `lib/flightdeck`, backed by the Flightdeck storefront SDK (`@dscodotco/sdk`).
 *
 * It exports the SAME function names, signatures, and normalized return types
 * (`Product`, `Cart`, `Collection`, `Menu`, `Page`, …) the rest of the template
 * imports from `lib/flightdeck`, so swapping the provider is: delete `lib/flightdeck`,
 * drop in `lib/flightdeck`, repoint imports. See ./README.md.
 *
 * ── THE ONE REAL IMPEDANCE MISMATCH: the cart ────────────────────────────────
 * Next.js Commerce assumes a SERVER-SIDE cart with a hosted `checkoutUrl` — the
 * Shopify model: you create a cart object on Shopify, mutate its lines over the
 * API, and redirect the shopper to Shopify's hosted checkout page.
 *
 * Flightdeck has NO server cart and NO hosted checkout. Checkout is ONE shot:
 * `store.checkout.submit({ items, card, … })` tenders and captures in a single
 * call. So there is nothing on our side to hold a mutable cart or to redirect to.
 *
 * We bridge that gap with a COOKIE-BACKED local cart:
 *   • The cart lives entirely in an httpOnly cookie (`fd_cart`) as an opaque id
 *     plus a list of `{ variantId, productHandle, quantity }` lines. We store
 *     NO prices in the cookie.
 *   • Every `getCart()` RE-PRICES from the live catalog (`products.get`), so a
 *     tampered cookie can never set the price and stale prices can't linger. A
 *     line whose product/variant 404s (discontinued) is pruned; any OTHER fetch
 *     error THROWS — we never silently under-price or drop a live cart.
 *   • `cart.checkoutUrl` points at a first-party route (`/api/checkout`) that
 *     reads the same cookie and calls `store.checkout.submit`. A sample handler
 *     lives at `app/api/checkout/route.ts` — the fork owns the payment-form UI
 *     (Flightdeck takes the card directly; there is no hosted page to defer to).
 *
 * Every other Flightdeck↔Shopify gap is a NARROW, DOCUMENTED fallback below,
 * never a silent fake: an unknown product/collection returns the exact
 * "not found" shape the template expects (`undefined` / `[]`), while a real
 * fetch failure propagates as a thrown `FlightdeckError`.
 */

import { createHash } from "node:crypto";
import {
  type components,
  createStorefrontClient,
  FlightdeckError,
  type StorefrontClient,
} from "@dscodotco/sdk";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  type Cart,
  type CartItem,
  type Collection,
  centsToMoney,
  decodeMerchandiseId,
  encodeMerchandiseId,
  type Menu,
  mapCollection,
  mapImage,
  mapProduct,
  menuFromManifest,
  type Page,
  type Product,
  type StorefrontProduct,
  type StorefrontVariant,
  SYNTHETIC_OPTION_NAME,
  variantTitle,
} from "./types";

export * from "./types";

// ── Client bootstrap (server-only credentials) ───────────────────────────────

/** Read a required env var or fail loudly — a missing credential is not "empty". */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is not set. The Flightdeck adapter needs FLIGHTDECK_API_URL, ` +
        "FLIGHTDECK_TENANT, and FLIGHTDECK_STOREFRONT_TOKEN in the server env " +
        "(Vercel project settings / .env.local).",
    );
  }
  return value;
}

let cachedClient: StorefrontClient | undefined;

/**
 * The tenant-pinned storefront client, lazily built once per server runtime.
 * The storefront token is SERVER-ONLY — these functions must only ever run in
 * server components, server actions, or route handlers.
 */
function getStore(): StorefrontClient {
  if (cachedClient !== undefined) return cachedClient;
  cachedClient = createStorefrontClient({
    apiUrl: requireEnv("FLIGHTDECK_API_URL"),
    tenant: requireEnv("FLIGHTDECK_TENANT"),
    storefrontToken: requireEnv("FLIGHTDECK_STOREFRONT_TOKEN"),
  });
  return cachedClient;
}

/** True only for a genuine "not found" — the one case we may map to absence. */
function isNotFound(error: unknown): boolean {
  return error instanceof FlightdeckError && error.status === 404;
}

// ── Catalog reads ────────────────────────────────────────────────────────────

/** Lowest variant price (integer cents) of a raw product, for price sorting. */
function minPriceCents(product: StorefrontProduct): number {
  const cents = product.variants.map((variant) => variant.price_cents);
  return cents.length > 0 ? Math.min(...cents) : 0;
}

/**
 * Apply Next.js Commerce's sort semantics over raw products.
 * Only `PRICE` is a true field sort here; `RELEVANCE` keeps the API's order
 * (search relevance / catalog order), and `BEST_SELLING` / `CREATED_AT` fall
 * back to that same order — Flightdeck's storefront catalog exposes neither a
 * sales signal nor timestamps (documented gap). `reverse` flips the result.
 */
function sortRawProducts(
  products: StorefrontProduct[],
  sortKey: string | undefined,
  reverse: boolean | undefined,
): StorefrontProduct[] {
  const sorted = [...products];
  if (sortKey === "PRICE") {
    sorted.sort((a, b) => minPriceCents(a) - minPriceCents(b));
  }
  if (reverse === true) sorted.reverse();
  return sorted;
}

export async function getProducts({
  query,
  reverse,
  sortKey,
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  const store = getStore();
  // A search query routes to the faceted search endpoint; otherwise list all.
  const raw = query
    ? (await store.search({ q: query })).products
    : (await store.products.list()).products;
  return sortRawProducts(raw, sortKey, reverse).map(mapProduct);
}

/** One product by handle (slug). Returns `undefined` for an unknown product. */
export async function getProduct(handle: string): Promise<Product | undefined> {
  const store = getStore();
  try {
    const { product } = await store.products.get(handle);
    return mapProduct(product);
  } catch (error) {
    if (isNotFound(error)) return undefined; // honest absence
    throw error; // a real failure is never an empty result
  }
}

/**
 * "Related products". Flightdeck has no recommendation engine yet, so this is a
 * deliberately-naive fallback: other active products from the catalog, minus the
 * current one. Documented as a placeholder — TODO: back with a real recommender.
 */
export async function getProductRecommendations(
  productId: string,
): Promise<Product[]> {
  const store = getStore();
  const { products } = await store.products.list();
  return products
    .filter((product) => product.id !== productId)
    .slice(0, 8)
    .map(mapProduct);
}

/** One collection by handle. Returns `undefined` for an unknown collection. */
export async function getCollection(
  handle: string,
): Promise<Collection | undefined> {
  const store = getStore();
  try {
    const { collection } = await store.collections.get(handle);
    return mapCollection(collection);
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey,
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  const store = getStore();
  // The template uses an empty handle for the "all products" homepage grid.
  if (collection === "") {
    const { products } = await store.products.list();
    return sortRawProducts(products, sortKey, reverse).map(mapProduct);
  }
  try {
    const { products } = await store.collections.get(collection);
    return sortRawProducts(products, sortKey, reverse).map(mapProduct);
  } catch (error) {
    // A collection that does not exist genuinely has zero products — return [].
    // Any other failure throws (a failed read is never an empty result).
    if (isNotFound(error)) return [];
    throw error;
  }
}

export async function getCollections(): Promise<Collection[]> {
  const store = getStore();
  const { collections } = await store.collections.list();
  // Mirror the template: prepend a synthetic "All" collection and drop any
  // slug the store marks hidden (convention: a `hidden` prefix).
  const all: Collection = {
    handle: "",
    title: "All",
    description: "All products",
    seo: { title: "All", description: "All products" },
    path: "/search",
    updatedAt: "",
  };
  const visible = collections
    .filter((collection) => !collection.slug.startsWith("hidden"))
    .map(mapCollection);
  return [all, ...visible];
}

/** The collections-derived menu — the FALLBACK when no nav was authored. */
async function menuFromCollections(): Promise<Menu[]> {
  const store = getStore();
  const { collections } = await store.collections.list();
  return [
    { title: "All", path: "/search" },
    ...collections
      .filter((collection) => !collection.slug.startsWith("hidden"))
      .map((collection) => ({
        title: collection.title,
        path: `/search/${collection.slug}`,
      })),
  ];
}

/**
 * Navigation menu — the MERCHANT-AUTHORED nav, not an invention (ADR-0014:
 * silently diverging from what the merchant authored is a defect). The store
 * manifest (`store.site.get()`, `GET /v1/tenants/{tenant}/site`) carries the
 * authored `header-nav` section; its `links` map directly to `Menu` items.
 *
 * Fallback is NARROW and only for genuine absence:
 *   - the site endpoint 404s (store not live / no manifest published), or
 *   - the manifest has no `header-nav` section at all.
 * In exactly those cases we derive a best-effort menu from the collection
 * list, as before. Any OTHER site-fetch failure throws — a failed read is
 * never silently papered over with a fabricated nav.
 *
 * `handle` (Shopify's menu handle, e.g. header vs footer) has no Flightdeck
 * equivalent: the manifest authors ONE header nav, so it is ignored. No
 * memoization — matching the rest of the adapter, every read hits the API
 * and Next.js' own fetch/route caching decides reuse.
 */
export async function getMenu(handle: string): Promise<Menu[]> {
  void handle;
  const store = getStore();
  let manifest: Awaited<ReturnType<typeof store.site.get>>["manifest"];
  try {
    ({ manifest } = await store.site.get());
  } catch (error) {
    if (isNotFound(error)) return menuFromCollections(); // no live site — honest fallback
    throw error;
  }
  const authored = menuFromManifest(manifest);
  if (authored === undefined) return menuFromCollections(); // no header-nav section authored
  return authored;
}

/**
 * CMS page by handle. The site manifest (`store.site.get()`) carries the
 * merchant-authored HOME-PAGE section list — it is not a collection of
 * arbitrary CMS pages, so there is nothing honest to resolve a `/[page]`
 * handle against. Always `undefined` — the template's `/[page]` route
 * already calls `notFound()` when a page is missing. Return type is widened
 * to `| undefined` (vs Shopify's non-optional `Page`) rather than fabricate
 * a page. TODO: back with a content service if the platform grows one.
 */
export async function getPage(handle: string): Promise<Page | undefined> {
  void handle;
  return undefined;
}

/**
 * All CMS pages. Same honest absence as `getPage`: the manifest describes
 * the home page's sections (`GET /v1/tenants/{tenant}/site`), not a CMS page
 * set — so this is `[]`, never invented pages. TODO: content service.
 */
export async function getPages(): Promise<Page[]> {
  return [];
}

// ── Cookie-backed cart ───────────────────────────────────────────────────────

const CART_COOKIE = "fd_cart";
/** Where `cart.checkoutUrl` points — the first-party checkout route handler. */
const CHECKOUT_URL = "/api/checkout";

/** The minimal cart state we persist in the cookie — prices are NEVER stored. */
interface StoredLine {
  variantId: string;
  productHandle: string;
  quantity: number;
}
interface StoredCart {
  id: string;
  lines: StoredLine[];
}

/** Narrow untrusted cookie JSON into a `StoredCart` (no `any`). */
function isStoredCart(value: unknown): value is StoredCart {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !Array.isArray(candidate.lines))
    return false;
  return candidate.lines.every((line) => {
    if (typeof line !== "object" || line === null) return false;
    const l = line as Record<string, unknown>;
    return (
      typeof l.variantId === "string" &&
      typeof l.productHandle === "string" &&
      typeof l.quantity === "number"
    );
  });
}

async function readStoredCart(): Promise<StoredCart | undefined> {
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  if (raw === undefined || raw === "") return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredCart(parsed) ? parsed : undefined;
  } catch {
    return undefined; // a corrupt cookie is "no usable cart", not an error
  }
}

async function writeStoredCart(cart: StoredCart): Promise<void> {
  (await cookies()).set(CART_COOKIE, JSON.stringify(cart), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Build a normalized `CartItem` from a live product+variant and a quantity. */
function buildCartItem(
  product: StorefrontProduct,
  variant: StorefrontVariant,
  quantity: number,
): CartItem {
  const title = variantTitle(variant);
  return {
    id: encodeMerchandiseId(product.slug, variant.id),
    quantity,
    cost: {
      totalAmount: centsToMoney(
        variant.price_cents * quantity,
        variant.currency,
      ),
    },
    merchandise: {
      id: encodeMerchandiseId(product.slug, variant.id),
      title,
      selectedOptions: [{ name: SYNTHETIC_OPTION_NAME, value: title }],
      product: {
        id: product.id,
        handle: product.slug,
        title: product.name,
        featuredImage: mapImage(product.image_asset_ref, product.name),
      },
    },
  };
}

/**
 * Re-price stored lines against the LIVE catalog and assemble a normalized
 * `Cart`. Discontinued lines (product/variant 404) are pruned; any other fetch
 * error throws. Shipping and tax are unknown until checkout tender, so
 * `totalTaxAmount` is zero and `totalAmount === subtotalAmount` here.
 */
async function priceStoredCart(stored: StoredCart): Promise<Cart> {
  const store = getStore();

  // Fetch each referenced product once (dedupe by handle).
  const handles = [...new Set(stored.lines.map((line) => line.productHandle))];
  const productByHandle = new Map<string, StorefrontProduct>();
  for (const handle of handles) {
    try {
      const { product } = await store.products.get(handle);
      productByHandle.set(handle, product);
    } catch (error) {
      if (isNotFound(error)) continue; // discontinued — its lines prune below
      throw error;
    }
  }

  const lines: CartItem[] = [];
  let subtotalCents = 0;
  let totalQuantity = 0;
  let currency = "USD";

  for (const line of stored.lines) {
    const product = productByHandle.get(line.productHandle);
    if (product === undefined) continue; // discontinued product
    const variant = product.variants.find(
      (candidate) => candidate.id === line.variantId,
    );
    if (variant === undefined) continue; // discontinued variant
    currency = variant.currency;
    subtotalCents += variant.price_cents * line.quantity;
    totalQuantity += line.quantity;
    lines.push(buildCartItem(product, variant, line.quantity));
  }

  return {
    id: stored.id,
    checkoutUrl: CHECKOUT_URL,
    totalQuantity,
    lines,
    cost: {
      subtotalAmount: centsToMoney(subtotalCents, currency),
      totalAmount: centsToMoney(subtotalCents, currency),
      totalTaxAmount: centsToMoney(0, currency),
    },
  };
}

/** A fresh, empty stored cart with an opaque id. */
function emptyStoredCart(): StoredCart {
  return { id: crypto.randomUUID(), lines: [] };
}

export async function createCart(): Promise<Cart> {
  const stored = emptyStoredCart();
  await writeStoredCart(stored);
  return priceStoredCart(stored);
}

export async function getCart(): Promise<Cart | undefined> {
  const stored = await readStoredCart();
  if (stored === undefined) return undefined;
  return priceStoredCart(stored);
}

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const stored = (await readStoredCart()) ?? emptyStoredCart();
  for (const line of lines) {
    const { handle, variantId } = decodeMerchandiseId(line.merchandiseId);
    const existing = stored.lines.find(
      (candidate) => candidate.variantId === variantId,
    );
    if (existing !== undefined) {
      existing.quantity += line.quantity;
    } else {
      stored.lines.push({
        variantId,
        productHandle: handle,
        quantity: line.quantity,
      });
    }
  }
  await writeStoredCart(stored);
  return priceStoredCart(stored);
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const stored = (await readStoredCart()) ?? emptyStoredCart();
  const removeVariantIds = new Set(
    lineIds.map((id) => decodeMerchandiseId(id).variantId),
  );
  stored.lines = stored.lines.filter(
    (line) => !removeVariantIds.has(line.variantId),
  );
  await writeStoredCart(stored);
  return priceStoredCart(stored);
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const stored = (await readStoredCart()) ?? emptyStoredCart();
  for (const line of lines) {
    const { handle, variantId } = decodeMerchandiseId(line.merchandiseId);
    const existing = stored.lines.find(
      (candidate) => candidate.variantId === variantId,
    );
    if (line.quantity <= 0) {
      stored.lines = stored.lines.filter(
        (candidate) => candidate.variantId !== variantId,
      );
    } else if (existing !== undefined) {
      existing.quantity = line.quantity;
    } else {
      stored.lines.push({
        variantId,
        productHandle: handle,
        quantity: line.quantity,
      });
    }
  }
  await writeStoredCart(stored);
  return priceStoredCart(stored);
}

// ── Checkout (one-shot) ──────────────────────────────────────────────────────

type CheckoutBody = Parameters<StorefrontClient["checkout"]["submit"]>[0];
export type CheckoutResult = Awaited<
  ReturnType<StorefrontClient["checkout"]["submit"]>
>;

/**
 * Everything the one-shot checkout needs that the cart cookie does NOT hold:
 * the customer ref, the card, coupon, shipping address, etc. The line `items`
 * are supplied by us from the current cart, never by the caller — so a caller
 * can't check out a cart other than the one in their cookie.
 */
export type CheckoutInput = Omit<CheckoutBody, "items">;

/**
 * Place the current cookie cart's order via `store.checkout.submit`, then clear
 * the local cart on success. Called by the sample `/api/checkout` route handler.
 * Throws if the cart is empty; surfaces `FlightdeckError` from the API verbatim.
 */
export async function submitCheckout(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const stored = await readStoredCart();
  if (stored === undefined || stored.lines.length === 0) {
    throw new Error("Cannot check out: the cart is empty.");
  }
  const store = getStore();
  const items = stored.lines.map((line) => ({
    variant_id: line.variantId,
    quantity: line.quantity,
  }));
  // Localized assertion: `input` is the checkout body minus `items`; re-adding
  // `items` reconstructs the exact SDK body. (The SDK itself uses the same
  // localized-assertion pattern to keep the tenant-merge DRY.)
  const body = { ...input, items } as CheckoutBody;
  // The API REQUIRES a DETERMINISTIC Idempotency-Key: derived from the
  // business event (this exact cart for this customer), never random — a
  // network-retried submit replays the placed order instead of re-charging.
  const idempotencyKey = deriveCheckoutIdempotencyKey(
    input.customer_ref,
    items,
  );
  const result = await store.checkout.submit(body, { idempotencyKey });
  (await cookies()).delete(CART_COOKIE);
  return result;
}

/**
 * `checkout:<sha256(customer + sorted lines)>` — identical cart + customer
 * always yields the same key. A changed quantity or line set is a NEW
 * business event and gets a new key.
 */
function deriveCheckoutIdempotencyKey(
  customerRef: string,
  items: ReadonlyArray<{ variant_id: string; quantity: number }>,
): string {
  const canonicalLines = [...items]
    .sort((a, b) => a.variant_id.localeCompare(b.variant_id))
    .map((i) => `${i.variant_id}x${i.quantity}`)
    .join(",");
  const digest = createHash("sha256")
    .update(`${customerRef}|${canonicalLines}`)
    .digest("hex")
    .slice(0, 32);
  return `checkout:${digest}`;
}

// ── Revalidation webhook (no-op today) ───────────────────────────────────────

/**
 * Shopify's build revalidates on product/collection webhooks. Flightdeck emits
 * no catalog webhook yet, so this acknowledges the request without revalidating.
 * TODO: when Flightdeck ships cache-invalidation webhooks, verify the signature
 * and call `revalidateTag(...)` here.
 */
export async function revalidate(req: NextRequest): Promise<NextResponse> {
  void req;
  return NextResponse.json({
    status: 200,
    revalidated: false,
    now: Date.now(),
  });
}

export type { components };
/** Re-exported so the sample route handler and forks can catch API errors. */
export { FlightdeckError };
