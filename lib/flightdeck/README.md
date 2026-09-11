# Flightdeck adapter for Next.js Commerce

A drop-in replacement for Vercel [Next.js Commerce](https://github.com/vercel/commerce)'s
`lib/shopify` provider, backed by the Flightdeck storefront SDK (`@dscodotco/sdk`).
Every exported function keeps the **same name, signature, and normalized return
type** the rest of the template imports, so swapping the backend is mechanical.

## How to use it

1. **Fork** `vercel/commerce`.
2. **Delete** `lib/shopify/`.
3. **Copy** this `lib/flightdeck/` directory into `lib/flightdeck/` in your fork,
   and copy `app/api/checkout/route.ts` (the sample checkout handler) into your
   app.
4. **Repoint imports**: replace every `from 'lib/shopify'` / `from
'lib/shopify/types'` with `from 'lib/flightdeck'` / `from
'lib/flightdeck/types'`. (A repo-wide find/replace of the `lib/shopify`
   path segment does it.)
5. **Set env** (server-side only — the storefront token must never reach the
   browser bundle):

   ```bash
   FLIGHTDECK_API_URL=https://api.ruo.pro
   FLIGHTDECK_TENANT=your-tenant-ref
   FLIGHTDECK_STOREFRONT_TOKEN=sft_...
   ```

6. **Remove** the Shopify env vars (`SHOPIFY_STORE_DOMAIN`,
   `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_REVALIDATION_SECRET`) — unused.

Prices are integer **cents** inside Flightdeck; the adapter converts them to the
template's decimal-string `Money` (`{ amount: "49.99", currencyCode: "USD" }`).

## Function mapping

| Next.js Commerce fn                                     | Backed by                                                                       | Notes                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getProducts({query, sortKey, reverse})`                | `store.products.list()` or `store.search({q})`                                  | A `query` routes to faceted search. `PRICE` sorts by min variant cents; `RELEVANCE`/`BEST_SELLING`/`CREATED_AT` keep API order (no sales signal/timestamps).                                                                                      |
| `getProduct(handle)`                                    | `store.products.get(slug)`                                                      | Unknown product → `undefined`; real error throws.                                                                                                                                                                                                 |
| `getProductRecommendations(id)`                         | `store.products.list()`                                                         | **Placeholder**: "other products" minus the current one. No real recommender yet.                                                                                                                                                                 |
| `getCollection(handle)`                                 | `store.collections.get(slug)`                                                   | Unknown collection → `undefined`; real error throws.                                                                                                                                                                                              |
| `getCollectionProducts({collection, sortKey, reverse})` | `store.collections.get(slug)` (or `products.list()` for the empty "all" handle) | Unknown collection → `[]` (genuine absence); real error throws.                                                                                                                                                                                   |
| `getCollections()`                                      | `store.collections.list()`                                                      | Prepends a synthetic **All** collection; drops `hidden*` slugs.                                                                                                                                                                                   |
| `getMenu(handle)`                                       | `store.site.get()` (fallback: `store.collections.list()`)                       | **Authored nav**: the manifest's `header-nav` section links (`GET /v1/tenants/{tenant}/site`). Falls back to a collections-derived menu ONLY when the site 404s or no `header-nav` section exists. `handle` is ignored (one authored header nav). |
| `getPage(handle)`                                       | —                                                                               | **No backing.** Always `undefined` (return type widened to `Page \| undefined`). The site manifest carries the home-page section list, not arbitrary CMS pages.                                                                                   |
| `getPages()`                                            | —                                                                               | **No backing.** Always `[]` (same reason as `getPage`).                                                                                                                                                                                           |
| `getCart()`                                             | cookie + `store.products.get` (re-price)                                        | Cookie-backed; see below.                                                                                                                                                                                                                         |
| `createCart()`                                          | cookie                                                                          | Writes an empty `fd_cart` cookie.                                                                                                                                                                                                                 |
| `addToCart(lines)`                                      | cookie + re-price                                                               | `merchandiseId` is a composite `handle::variantId`.                                                                                                                                                                                               |
| `removeFromCart(lineIds)`                               | cookie + re-price                                                               | Line id = composite merchandise id.                                                                                                                                                                                                               |
| `updateCart(lines)`                                     | cookie + re-price                                                               | Quantity `0` removes the line.                                                                                                                                                                                                                    |
| `submitCheckout(input)` _(new)_                         | `store.checkout.submit`                                                         | Places the cookie cart's order; clears the cart on success. Called by the sample route.                                                                                                                                                           |
| `revalidate(req)`                                       | —                                                                               | **No-op today.** Flightdeck emits no catalog webhook yet; returns 200 without revalidating.                                                                                                                                                       |
| `shopifyFetch`                                          | —                                                                               | **Not ported.** Shopify's GraphQL transport is internal to the old provider and has no consumer outside it.                                                                                                                                       |

Normalized types (`Product`, `Cart`, `Collection`, `Menu`, `Page`, `Image`,
`Money`, `ProductVariant`, `ProductOption`, `SEO`, `CartItem`) are re-exported
from `lib/flightdeck/types` — byte-compatible with Vercel's `lib/shopify/types`.

## The cart: the one real impedance mismatch

Next.js Commerce assumes a **server-side cart with a hosted `checkoutUrl`** (the
Shopify model). Flightdeck has **no server cart and no hosted checkout** — checkout
is one shot: `store.checkout.submit({ items, card, … })` tenders and captures in a
single call.

The adapter bridges this with a **cookie-backed local cart**:

- The cart lives entirely in an httpOnly `fd_cart` cookie — an opaque id plus
  `{ variantId, productHandle, quantity }` lines. **No prices are stored.**
- Every `getCart()` **re-prices from the live catalog**, so a tampered cookie
  can't set a price and stale prices can't linger. A line whose product/variant
  is gone (404) is pruned; **any other fetch error throws** — a live cart is
  never silently under-priced.
- Because the cart layer only ever hands us a `merchandiseId`, and Flightdeck has
  no product-by-variant lookup, the id the UI carries is a composite
  `"<handle>::<variantId>"` (encoded in `mapVariant`, decoded when pricing/placing).
- `cart.checkoutUrl` is `/api/checkout` — a **first-party** route (sample in
  `app/api/checkout/route.ts`) that reads the same cookie and calls
  `submitCheckout`. Because Flightdeck takes the card directly, **your fork owns
  the payment-form UI** — there is no hosted page to redirect to. Gate that route
  with CSRF/rate-limits and tokenize the card as appropriate.

## Known gaps (documented, not faked)

- **`updatedAt`** is `""` for products and collections — the storefront catalog
  exposes no timestamps. Sorting/formatting by it is a no-op until the API adds it.
- **`descriptionHtml`** mirrors the plain-text `description` (no rich HTML).
- **`options`** are synthesized (one option, values = variant labels) because
  Flightdeck has no option axes.
- **`Image` dimensions** are `0` — Flightdeck exposes an opaque asset ref, not
  pixel dimensions. Point `next/image` at a custom loader for your asset host.
- **`tags`** carry only a derived `subscription` tag (from the real
  `is_subscription` flag); Flightdeck has no free-form tags.
- **Tax/shipping** are unknown until checkout tender, so `Cart.cost.totalTaxAmount`
  is `0` and `totalAmount === subtotalAmount` client-side.
