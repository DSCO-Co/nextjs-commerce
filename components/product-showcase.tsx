import { GridTileImage } from "components/grid/tile";
import { getProducts } from "lib/flightdeck";
import Link from "next/link";

/**
 * The catalog as an editorial grid — every compound a card, price in mono
 * (the store's lab-readout voice), reagent-teal on hover. Reads live from
 * the API on every request.
 */
export async function ProductShowcase() {
  const products = await getProducts({});
  if (!products.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="flex items-end justify-between gap-6 border-b border-ink-line pb-6">
        <div>
          <p className="eyebrow">The catalog</p>
          <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Compounds, on the shelf.
          </h2>
        </div>
        <Link
          href="/search"
          className="link-reagent data hidden text-xs uppercase tracking-widest text-mute sm:block"
        >
          View all &rarr;
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.slice(0, 8).map((product) => (
          <Link
            key={product.handle}
            href={`/product/${product.handle}`}
            prefetch
            className="block aspect-square"
          >
            <GridTileImage
              src={product.featuredImage.url}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              alt={product.title}
              label={{
                title: product.title,
                amount: product.priceRange.maxVariantPrice.amount,
                currencyCode: product.priceRange.maxVariantPrice.currencyCode,
              }}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
