import { AddToCart } from "components/cart/add-to-cart";
import Price from "components/price";
import Prose from "components/prose";
import { Product } from "lib/flightdeck/types";
import { VariantSelector } from "./variant-selector";

export function ProductDescription({ product }: { product: Product }) {
  const sku = product.variants[0]?.id?.split("::")[1] ?? "—";
  const spec: [string, string][] = [
    ["Form", "Lyophilized powder"],
    ["Purity", "≥99% HPLC"],
    ["Presentation", "Sealed vial"],
    ["Handling", "Store at −20°C"],
  ];

  return (
    <>
      <p className="eyebrow">Research use only</p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
        {product.title}
      </h1>
      <div className="mt-4 flex items-baseline gap-3 border-b border-ink-line pb-6">
        <Price
          className="data text-2xl text-reagent"
          amount={product.priceRange.maxVariantPrice.amount}
          currencyCode={product.priceRange.maxVariantPrice.currencyCode}
          currencyCodeClassName="ml-1 text-xs text-mute-deep"
        />
      </div>

      <div className="mt-6">
        <VariantSelector options={product.options} variants={product.variants} />
      </div>

      {product.descriptionHtml ? (
        <Prose
          className="mt-2 text-sm leading-relaxed text-mute"
          html={product.descriptionHtml}
        />
      ) : null}

      {/* Mono spec table — the lab-readout voice. */}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-ink-line py-6">
        {spec.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="eyebrow text-mute-deep">{k}</dt>
            <dd className="data mt-1 text-sm text-paper">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <AddToCart product={product} />
      </div>

      {/* COA callout — the store's trust artifact, stated plainly. */}
      <div className="mt-5 flex items-start gap-3 border border-ink-line bg-ink-raised/50 p-4">
        <span
          aria-hidden
          className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-reagent shadow-[0_0_8px_var(--color-reagent)]"
        />
        <p className="text-xs leading-relaxed text-mute">
          <span className="text-paper">Certificate of analysis</span> ships with
          this lot: HPLC purity, mass-spec identity, and endotoxin results,
          lot-matched. For in-vitro laboratory research only.
        </p>
      </div>
    </>
  );
}
