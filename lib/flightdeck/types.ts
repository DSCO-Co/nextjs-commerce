/**
 * Normalized commerce types + pure mapping helpers for the Flightdeck adapter.
 *
 * WHY this file exists (and why it duplicates Vercel's shapes):
 * Next.js Commerce's component tree (product grid, cart, gallery, search) imports
 * its NORMALIZED domain types — `Product`, `Cart`, `Collection`, `Money`, … —
 * from `lib/flightdeck/types`. When you swap `lib/flightdeck` for `lib/flightdeck`,
 * those imports move to `lib/flightdeck/types`. So this file re-declares the
 * SAME normalized shapes verbatim (resolved from Vercel's `Omit<Shopify*, …> &
 * …` compositions into flat object types) so the rest of the template compiles
 * unchanged. Keep these byte-compatible with Vercel's `lib/flightdeck/types.ts`.
 *
 * The mapping helpers below translate Flightdeck's storefront catalog shapes
 * (`components["schemas"]["Storefront*"]`, prices as INTEGER CENTS) into these
 * normalized types (prices as a decimal-string `Money`). They are pure and
 * synchronous so they can be unit-tested without any network.
 */
import type { components } from "@dscodotco/sdk";

// ── Flightdeck source shapes (integer cents) ────────────────────────────────
export type StorefrontProduct = components["schemas"]["StorefrontProduct"];
export type StorefrontVariant = components["schemas"]["StorefrontVariant"];
export type StorefrontCollection =
  components["schemas"]["StorefrontCollection"];
export type SiteManifest = components["schemas"]["SiteManifest"];

// ── Normalized target shapes (mirror Vercel's lib/flightdeck/types.ts) ──────────
export type Money = {
  amount: string;
  currencyCode: string;
};

export type Image = {
  url: string;
  altText: string;
  width: number;
  height: number;
};

export type SEO = {
  title: string;
  description: string;
};

export type ProductOption = {
  id: string;
  name: string;
  values: string[];
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: {
    name: string;
    value: string;
  }[];
  price: Money;
};

export type Product = {
  id: string;
  handle: string;
  availableForSale: boolean;
  title: string;
  description: string;
  descriptionHtml: string;
  options: ProductOption[];
  priceRange: {
    maxVariantPrice: Money;
    minVariantPrice: Money;
  };
  variants: ProductVariant[];
  featuredImage: Image;
  images: Image[];
  seo: SEO;
  tags: string[];
  updatedAt: string;
};

export type CartProduct = {
  id: string;
  handle: string;
  title: string;
  featuredImage: Image;
};

export type CartItem = {
  id: string | undefined;
  quantity: number;
  cost: {
    totalAmount: Money;
  };
  merchandise: {
    id: string;
    title: string;
    selectedOptions: {
      name: string;
      value: string;
    }[];
    product: CartProduct;
  };
};

export type Cart = {
  id: string | undefined;
  checkoutUrl: string;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money;
  };
  totalQuantity: number;
  lines: CartItem[];
};

export type Collection = {
  handle: string;
  title: string;
  description: string;
  seo: SEO;
  updatedAt: string;
  path: string;
};

export type Menu = {
  title: string;
  path: string;
};

export type Page = {
  id: string;
  title: string;
  handle: string;
  body: string;
  bodySummary: string;
  seo?: SEO;
  createdAt: string;
  updatedAt: string;
};

// ── The synthetic option name we hang variants off of ────────────────────────
// Flightdeck has no product-option model (no "Size"/"Color" axes); it has a flat
// list of SKUs/variants. Next.js Commerce's variant selector is driven by
// `product.options` + `variant.selectedOptions`, so we synthesize ONE option
// named this, whose values are the variant labels. A single-variant product gets
// no option (nothing to choose).
export const SYNTHETIC_OPTION_NAME = "Variant";

// ── Composite merchandise id (product handle + variant id) ───────────────────
// Next.js Commerce's cart layer only ever hands us a `merchandiseId` (the
// variant id) — Shopify resolves the owning product server-side. Flightdeck has
// no "product-by-variant" lookup, and our cart lives in a cookie that must be
// re-priced from the catalog on every read (never trust a client-sent price).
// So we make the id the UI carries a COMPOSITE `"<handle>::<variantId>"`: it
// travels through the variant selector and add-to-cart button unchanged, and we
// decode the handle back out when we need to fetch+price the line or place the
// order. This is the standard cookie-cart trick; it keeps us from inventing a
// reverse-lookup endpoint the API doesn't have.
const MERCHANDISE_SEPARATOR = "::";

/** Encode a product handle + raw variant id into the id the UI carries. */
export function encodeMerchandiseId(handle: string, variantId: string): string {
  return `${handle}${MERCHANDISE_SEPARATOR}${variantId}`;
}

/**
 * Decode a composite merchandise id back into its handle + variant id. A bare
 * id (no separator — e.g. a legacy/hand-built value) is treated as a raw
 * variant id with an unknown handle.
 */
export function decodeMerchandiseId(id: string): {
  handle: string;
  variantId: string;
} {
  const index = id.indexOf(MERCHANDISE_SEPARATOR);
  if (index === -1) return { handle: "", variantId: id };
  return {
    handle: id.slice(0, index),
    variantId: id.slice(index + MERCHANDISE_SEPARATOR.length),
  };
}

/**
 * Convert integer cents to a decimal-string amount (Vercel's `Money.amount`),
 * using integer math so we never introduce a float-rounding artifact
 * (e.g. 4999 → "49.99", 100000 → "1000.00", -500 → "-5.00"). Two decimal
 * places always; this is a display/string amount, not a currency-aware format.
 */
export function centsToDecimalString(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.trunc(abs / 100);
  const remainder = abs % 100;
  return `${negative ? "-" : ""}${dollars}.${String(remainder).padStart(2, "0")}`;
}

/** Build a normalized `Money` from integer cents + an ISO currency code. */
export function centsToMoney(cents: number, currency: string): Money {
  return {
    amount: centsToDecimalString(cents),
    currencyCode: currency.toUpperCase(),
  };
}

/**
 * A best-effort `Image` from Flightdeck's opaque `image_asset_ref`.
 *
 * GAP: Flightdeck's storefront catalog exposes an asset REFERENCE (an id/URL the
 * store's own image loader resolves), not concrete pixel dimensions. Next.js
 * Commerce's `Image` requires `width`/`height` for `next/image`. We pass the ref
 * through as `url` and set dimensions to 0 — the forked template should point
 * `images.remotePatterns` / a custom loader at your asset host, which supplies
 * real dimensions at render. When there is no ref we still must return an
 * `Image` (the field is non-optional upstream); we return an empty-url image
 * rather than fabricate one. TODO: expose width/height from the catalog API.
 */
export function mapImage(assetRef: string | null, altText: string): Image {
  return { url: assetRef ?? "", altText, width: 0, height: 0 };
}

/** The human label for a variant — its `label`, falling back to its SKU. */
export function variantTitle(variant: StorefrontVariant): string {
  return variant.label ?? variant.sku;
}

/**
 * Map one Flightdeck variant to a normalized `ProductVariant`.
 *
 * `availableForSale` is derived from the PARENT product's status (passed in):
 * Flightdeck's storefront catalog only lists purchasable variants of active
 * products and carries no per-variant stock signal, so "listed on an active
 * product" is the honest availability answer we can give. `selectedOptions`
 * pins the single synthetic option so the template's variant selector resolves.
 */
export function mapVariant(
  variant: StorefrontVariant,
  productActive: boolean,
  productSlug: string,
): ProductVariant {
  const title = variantTitle(variant);
  return {
    // Composite id so the cart layer can recover the owning product handle
    // (see encodeMerchandiseId). Add-to-cart carries this value verbatim.
    id: encodeMerchandiseId(productSlug, variant.id),
    title,
    availableForSale: productActive,
    selectedOptions: [{ name: SYNTHETIC_OPTION_NAME, value: title }],
    price: centsToMoney(variant.price_cents, variant.currency),
  };
}

/**
 * Map a Flightdeck `StorefrontProduct` to Next.js Commerce's normalized
 * `Product`. Prices come from the variants (integer cents → `Money`); the price
 * range spans the cheapest and dearest variant.
 *
 * Documented gaps (each an honest fallback, never a silent fake):
 *  - `descriptionHtml`: Flightdeck stores plain text only, so this mirrors
 *    `description` (no rich HTML). TODO if the catalog gains rich copy.
 *  - `options`: synthesized from the variant list (one option, values = labels),
 *    and only when there's more than one variant. Flightdeck has no option axes.
 *  - `tags`: Flightdeck exposes no free-form tags; we surface the one real
 *    boolean it has (`is_subscription`) as a `subscription` tag so filters work.
 *  - `updatedAt`: the storefront catalog exposes no timestamps. We return "" —
 *    an honestly-empty value, not a fabricated date. TODO: add to the API.
 *    (Consumers that sort/format by `updatedAt` should tolerate this.)
 */
export function mapProduct(product: StorefrontProduct): Product {
  const active = product.status === "active";
  const variants = product.variants.map((variant) =>
    mapVariant(variant, active, product.slug),
  );
  const currency = product.variants[0]?.currency ?? "USD";

  const priceCents = product.variants.map((variant) => variant.price_cents);
  const minCents = priceCents.length > 0 ? Math.min(...priceCents) : 0;
  const maxCents = priceCents.length > 0 ? Math.max(...priceCents) : 0;

  const options: ProductOption[] =
    product.variants.length > 1
      ? [
          {
            id: `${product.id}-${SYNTHETIC_OPTION_NAME.toLowerCase()}`,
            name: SYNTHETIC_OPTION_NAME,
            values: product.variants.map(variantTitle),
          },
        ]
      : [];

  const description = product.description ?? "";
  // Demo asset fallback: Flightdeck's demo catalog carries no image refs yet
  // (media pipeline pending), so fall back to a bundled per-handle product
  // image shipped in /public/products. A real store's image_asset_ref wins.
  const localAsset = `/products/${product.slug}.png`;
  const featuredImage = product.image_asset_ref
    ? mapImage(product.image_asset_ref, product.name)
    : { url: localAsset, altText: product.name, width: 1024, height: 1024 };

  return {
    id: product.id,
    handle: product.slug,
    availableForSale: active && variants.length > 0,
    title: product.name,
    description,
    descriptionHtml: description,
    options,
    priceRange: {
      minVariantPrice: centsToMoney(minCents, currency),
      maxVariantPrice: centsToMoney(maxCents, currency),
    },
    variants,
    featuredImage,
    images: [featuredImage],
    seo: { title: product.name, description },
    tags: product.is_subscription ? ["subscription"] : [],
    updatedAt: "",
  };
}

/**
 * Map a Flightdeck collection to Next.js Commerce's normalized `Collection`.
 * `path` is the template's canonical collection route (`/search/<handle>`).
 * `updatedAt` is empty for the same reason as products (no catalog timestamps).
 */
export function mapCollection(collection: StorefrontCollection): Collection {
  const description = collection.description ?? "";
  return {
    handle: collection.slug,
    title: collection.title,
    description,
    seo: { title: collection.title, description },
    updatedAt: "",
    path: `/search/${collection.slug}`,
  };
}

/**
 * Map the manifest's merchant-authored `header-nav` section to the
 * template's `Menu[]` (ADR-0014: the authored nav IS the nav). The section's
 * props carry `links: [{ label, href }]` (see
 * `packages/storefront-sections/src/sections/header-nav.tsx`). Returns
 * `undefined` when the manifest has NO header-nav section — the caller falls
 * back to a collections-derived menu; a present section with zero usable
 * links is an authored-empty menu (`[]`), not a fallback trigger.
 */
export function menuFromManifest(manifest: SiteManifest): Menu[] | undefined {
  const headerNav = manifest.template?.sections?.find(
    (section) => section.type === "header-nav",
  );
  if (headerNav === undefined) return undefined;
  const links = headerNav.props.links;
  if (!Array.isArray(links)) return [];
  const items: Menu[] = [];
  for (const link of links) {
    if (typeof link !== "object" || link === null) continue;
    const { label, href } = link as Record<string, unknown>;
    if (typeof label === "string" && typeof href === "string") {
      items.push({ title: label, path: href });
    }
  }
  return items;
}
