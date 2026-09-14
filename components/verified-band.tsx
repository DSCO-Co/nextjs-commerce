/**
 * The trust proposition, stated in the store's own vocabulary. A quiet
 * chromatogram divider (the signature, reprised) over three plain guarantees
 * — no badges, no seals graphics, just the record.
 */
const MINI_TRACE =
  "M0 40 L200 40 L240 38 L300 39 L340 12 L360 39 L440 40 " +
  "L520 39 L560 22 L580 40 L680 41 L760 40 L800 30 L816 41 L900 40 L1000 40";

const POINTS = [
  ["01", "Certificate of analysis", "Every lot ships with HPLC purity, mass-spec identity, and endotoxin results — downloadable, lot-matched."],
  ["02", "Verifiable provenance", "Each batch carries a supplier seal you can check against the source registry, independently."],
  ["03", "Research use only", "Sold for in-vitro laboratory research. Not for human or veterinary use, and we never pretend otherwise."],
];

export function VerifiedBand() {
  return (
    <section className="relative border-y border-ink-line bg-ink-raised/40">
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 h-16 w-full opacity-40"
        viewBox="0 0 1000 60"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={MINI_TRACE}
          fill="none"
          stroke="var(--color-reagent)"
          strokeWidth="1"
        />
      </svg>
      <div className="mx-auto max-w-6xl px-6 py-24">
        <p className="eyebrow">Why the record matters</p>
        <h2 className="font-display mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          A compound is only as good as its paperwork.
        </h2>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {POINTS.map(([n, title, body]) => (
            <div key={n} className="border-t border-ink-line pt-5">
              <span className="data text-xs text-reagent">{n}</span>
              <h3 className="font-display mt-3 text-lg font-medium tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
