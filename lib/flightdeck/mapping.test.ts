/**
 * Unit tests for the Flightdeck → Next.js Commerce mapping layer.
 *
 * Two things are proven:
 *   1. Price mapping: integer cents → a decimal-string `Money.amount`, exactly,
 *      with no float artifacts.
 *   2. Catalog → normalized `Product`: both the pure mapper AND the real SDK
 *      path (with an injected fetch mock, mirroring the SDK's own
 *      storefront.test.ts) produce the normalized shape the template consumes.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createStorefrontClient } from "@dscodotco/sdk";
import {
  centsToDecimalString,
  centsToMoney,
  decodeMerchandiseId,
  encodeMerchandiseId,
  mapProduct,
  menuFromManifest,
  type SiteManifest,
  type StorefrontProduct,
} from "./types";

// ── fixtures ─────────────────────────────────────────────────────────────────

function multiVariantProduct(): StorefrontProduct {
  return {
    id: "prod_1",
    tenant_ref: "nova-peptide",
    slug: "peptide-x",
    name: "Peptide X",
    description: "A research peptide.",
    status: "active",
    image_asset_ref: "https://cdn.example.com/peptide-x.png",
    is_subscription: false,
    subscription_interval: null,
    subscription_interval_count: null,
    subscription_price_cents: null,
    variants: [
      {
        id: "var_1",
        tenant_ref: "nova-peptide",
        product_id: "prod_1",
        sku: "NOVA-X-5MG",
        label: "5mg vial",
        price_cents: 4999,
        currency: "usd",
      },
      {
        id: "var_2",
        tenant_ref: "nova-peptide",
        product_id: "prod_1",
        sku: "NOVA-X-10MG",
        label: "10mg vial",
        price_cents: 8999,
        currency: "usd",
      },
    ],
  };
}

// ── price mapping ────────────────────────────────────────────────────────────

test("centsToDecimalString renders exact two-decimal amounts with no float drift", () => {
  assert.equal(centsToDecimalString(0), "0.00");
  assert.equal(centsToDecimalString(5), "0.05");
  assert.equal(centsToDecimalString(4999), "49.99");
  assert.equal(centsToDecimalString(100000), "1000.00");
  assert.equal(centsToDecimalString(-500), "-5.00");
});

test("centsToMoney upper-cases the currency and pairs it with the decimal amount", () => {
  assert.deepEqual(centsToMoney(4999, "usd"), {
    amount: "49.99",
    currencyCode: "USD",
  });
});

// ── merchandise-id round trip ────────────────────────────────────────────────

test("encode/decode merchandise id round-trips handle + variant id", () => {
  const id = encodeMerchandiseId("peptide-x", "var_1");
  assert.equal(id, "peptide-x::var_1");
  assert.deepEqual(decodeMerchandiseId(id), {
    handle: "peptide-x",
    variantId: "var_1",
  });
  // A bare id (no separator) decodes to an unknown handle + raw variant id.
  assert.deepEqual(decodeMerchandiseId("var_9"), {
    handle: "",
    variantId: "var_9",
  });
});

// ── catalog → Product (pure mapper) ──────────────────────────────────────────

test("mapProduct normalizes a multi-variant active product to the template shape", () => {
  const product = mapProduct(multiVariantProduct());

  assert.equal(product.id, "prod_1");
  assert.equal(product.handle, "peptide-x");
  assert.equal(product.title, "Peptide X");
  assert.equal(product.availableForSale, true);

  // plain-text description mirrored into descriptionHtml (no rich HTML upstream)
  assert.equal(product.description, "A research peptide.");
  assert.equal(product.descriptionHtml, "A research peptide.");

  // price range spans cheapest→dearest variant, as decimal-string Money
  assert.deepEqual(product.priceRange.minVariantPrice, {
    amount: "49.99",
    currencyCode: "USD",
  });
  assert.deepEqual(product.priceRange.maxVariantPrice, {
    amount: "89.99",
    currencyCode: "USD",
  });

  // variants carry composite ids + the synthetic option
  assert.equal(product.variants.length, 2);
  assert.equal(product.variants[0]?.id, "peptide-x::var_1");
  assert.deepEqual(product.variants[0]?.price, {
    amount: "49.99",
    currencyCode: "USD",
  });
  assert.deepEqual(product.variants[0]?.selectedOptions, [
    { name: "Variant", value: "5mg vial" },
  ]);
  assert.equal(product.variants[0]?.availableForSale, true);

  // one synthesized option whose values are the variant labels
  assert.equal(product.options.length, 1);
  assert.equal(product.options[0]?.name, "Variant");
  assert.deepEqual(product.options[0]?.values, ["5mg vial", "10mg vial"]);

  // image ref passed through; no fabricated tags
  assert.equal(
    product.featuredImage.url,
    "https://cdn.example.com/peptide-x.png",
  );
  assert.equal(product.images.length, 1);
  assert.deepEqual(product.tags, []);
});

test("mapProduct: a single-variant product synthesizes NO option", () => {
  const source = multiVariantProduct();
  source.variants = [
    source.variants[0] as StorefrontProduct["variants"][number],
  ];
  const product = mapProduct(source);
  assert.equal(product.options.length, 0);
  assert.equal(product.variants.length, 1);
});

test("mapProduct: an inactive product is not available for sale (and neither are its variants)", () => {
  const source = multiVariantProduct();
  source.status = "draft";
  const product = mapProduct(source);
  assert.equal(product.availableForSale, false);
  assert.equal(product.variants[0]?.availableForSale, false);
});

test("mapProduct: a subscription product surfaces a 'subscription' tag, no image → empty images", () => {
  const source = multiVariantProduct();
  source.is_subscription = true;
  source.image_asset_ref = null;
  const product = mapProduct(source);
  assert.deepEqual(product.tags, ["subscription"]);
  assert.equal(product.images.length, 0);
  assert.equal(product.featuredImage.url, "");
});

// ── manifest header-nav → Menu ───────────────────────────────────────────────

test("menuFromManifest maps the authored header-nav links to Menu items", () => {
  const manifest: SiteManifest = {
    template: {
      sections: [
        { type: "announcement-bar", props: { text: "hi" } },
        {
          type: "header-nav",
          props: {
            logoText: "LOOP BIO LABS",
            links: [
              { label: "Shop", href: "/#catalog" },
              { label: "COAs", href: "/#coas" },
              { label: "FAQ", href: "/#faq" },
            ],
          },
        },
      ],
    },
  };
  assert.deepEqual(menuFromManifest(manifest), [
    { title: "Shop", path: "/#catalog" },
    { title: "COAs", path: "/#coas" },
    { title: "FAQ", path: "/#faq" },
  ]);
});

test("menuFromManifest: no header-nav section → undefined (caller falls back to collections)", () => {
  assert.equal(menuFromManifest({}), undefined);
  assert.equal(
    menuFromManifest({
      template: { sections: [{ type: "epic-hero", props: {} }] },
    }),
    undefined,
  );
});

test("menuFromManifest: a present header-nav with no usable links is an authored-empty menu, not a fallback", () => {
  assert.deepEqual(
    menuFromManifest({
      template: { sections: [{ type: "header-nav", props: {} }] },
    }),
    [],
  );
  // Malformed link entries are dropped, well-formed ones kept.
  const manifest: SiteManifest = {
    template: {
      sections: [
        {
          type: "header-nav",
          props: {
            links: [{ label: "Shop" }, "junk", { label: "FAQ", href: "/#faq" }],
          },
        },
      ],
    },
  };
  assert.deepEqual(menuFromManifest(manifest), [
    { title: "FAQ", path: "/#faq" },
  ]);
});

// ── catalog → Product through the real SDK (injected fetch mock) ─────────────

/** A recording mock fetch — no network. Returns a canned JSON body. */
function mockFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

test("SDK products.list → mapProduct produces normalized products end to end", async () => {
  const store = createStorefrontClient({
    apiUrl: "https://api.ruo.pro",
    tenant: "nova-peptide",
    storefrontToken: "sft_secret",
    fetch: mockFetch(200, { products: [multiVariantProduct()] }),
  });

  const { products } = await store.products.list();
  const normalized = products.map(mapProduct);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0]?.handle, "peptide-x");
  assert.deepEqual(normalized[0]?.priceRange.minVariantPrice, {
    amount: "49.99",
    currencyCode: "USD",
  });
});
