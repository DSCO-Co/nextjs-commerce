# Next.js Commerce on the dsco commerce platform

[Vercel's Next.js Commerce](https://github.com/vercel/commerce) template running on
the dsco/Flightdeck commerce platform instead of Shopify, via the published
[`@dscodotco/sdk`](https://www.npmjs.com/package/@dscodotco/sdk) storefront client.

This is a fork of `vercel/commerce` (MIT, Copyright (c) 2025 Vercel, Inc. — see
[license.md](license.md)). The UI, routing, and server-component architecture are
Vercel's; the only structural change is the commerce provider.

> Status: this demo goes fully live when the platform's public API surface
> (`https://api.ruo.pro/v1/...`) deploys. Until then the app builds and runs, but
> catalog reads against the demo tenant will fail at request time. The repo is
> published ahead of that so the integration diff is reviewable.

## The provider swap

Next.js Commerce isolates its backend in `lib/shopify`. This fork deletes that
directory and drops in [`lib/flightdeck`](lib/flightdeck) — a provider that exports
the same function names, signatures, and normalized return types (`Product`,
`Cart`, `Collection`, `Menu`, `Page`, ...), backed by `@dscodotco/sdk`. Every
`from "lib/shopify"` import was repointed to `lib/flightdeck`; no component or
route markup changed.

What differs beyond the mechanical swap:

- Cart: Flightdeck has no server-side cart or hosted checkout. The cart is a
  cookie-backed local cart, re-priced from the live catalog on every read
  (no prices are stored client-side). `cart.checkoutUrl` points at a first-party
  [`/api/checkout`](app/api/checkout/route.ts) route that submits the order in one
  shot; a real store owns the payment-form UI in front of it.
- Rendering: the app is fully dynamic (`force-dynamic`, PPR off) — catalog reads
  hit the API at request time, so the build needs no network access and catalog
  changes show up immediately.
- Env validation now checks the Flightdeck variables instead of Shopify's.

The full function-by-function mapping table, the cookie-cart design, and the
normalized-type notes live in [`lib/flightdeck/README.md`](lib/flightdeck/README.md).

## Environment

Copy [.env.example](.env.example) to `.env.local`. All values are read server-side
only; nothing is prefixed `NEXT_PUBLIC_`.

| Variable                      | What it is                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `FLIGHTDECK_API_URL`          | The commerce API origin the store reads catalog from and places orders against (`https://api.ruo.pro`). |
| `FLIGHTDECK_TENANT`           | The tenant this deployment serves. The public demo uses `ruo-demo`.                                     |
| `FLIGHTDECK_STOREFRONT_TOKEN` | The tenant-scoped storefront credential. Secret — server-side only.                                     |
| `SITE_NAME`, `COMPANY_NAME`   | Optional template branding (unchanged from upstream).                                                   |

## Honest gaps

The adapter documents what it does not back rather than faking it:

- `getProductRecommendations` is naive — "other products" minus the current one.
  There is no recommender yet.
- `getPage` / `getPages` return empty. Merchant-authored content exists on the
  platform (the store manifest), but mapping it into CMS-style pages is pending;
  the adapter returns honest absence instead of inventing a CMS. `/[page]` routes
  404 for now.
- `revalidate` is a no-op — the platform emits no catalog webhook yet, so
  `/api/revalidate` returns 200 without revalidating anything.
- Product `updatedAt` is empty, image dimensions are `0` (opaque asset refs), and
  options are synthesized from variant labels. Details in
  [`lib/flightdeck/README.md`](lib/flightdeck/README.md#known-gaps-documented-not-faked).

## Running locally

```bash
pnpm install
cp .env.example .env.local   # fill in your tenant + storefront token
pnpm dev
```

The app runs on [localhost:3000](http://localhost:3000/). `pnpm build` needs no
network access — all catalog reads happen at request time.

## Related

- [`@dscodotco/sdk`](https://www.npmjs.com/package/@dscodotco/sdk) — the typed
  storefront/operator client this provider is built on.
- [DSCO-Co/storefront-starter](https://github.com/DSCO-Co/storefront-starter) — a
  from-scratch starter storefront on the same SDK, if you would rather not carry
  the Next.js Commerce template.

## Attribution and license

Forked from [vercel/commerce](https://github.com/vercel/commerce). Released under
the [MIT License](license.md), Copyright (c) 2025 Vercel, Inc. Modifications
(the Flightdeck provider and this README) are also MIT.
