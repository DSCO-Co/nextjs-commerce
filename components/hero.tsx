import Link from "next/link";

/**
 * The hero is the thesis: a research-supply store whose defining artifact is
 * the certificate-of-analysis chromatogram. The trace draws itself on load
 * (the reagent-teal signature), over a luminous spectral field, under an
 * editorial statement set in the display face with the technical facts in
 * mono — the store's own lab-readout vocabulary.
 */

// A believable HPLC-style trace: quiet baseline with a few sharp elution
// peaks. Hand-tuned path over a 1200x360 viewBox.
const TRACE =
  "M0 320 L120 320 L150 318 L210 316 L250 314 L300 316 " +
  "L360 314 L400 232 L420 316 L470 314 L540 315 " +
  "L600 300 L640 205 L662 300 L700 314 L760 315 " +
  "L820 314 L880 258 L905 314 L980 315 L1040 313 " +
  "L1090 270 L1110 314 L1160 318 L1200 320";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-ink-line">
      {/* Luminous spectral field, generated, faint. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-70"
        style={{ backgroundImage: "url(/art/hero-spectrum.png)" }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-ink/40 via-ink/10 to-ink" />

      {/* The chromatogram signature, spanning the lower band. */}
      <svg
        className="chromatogram bottom-0 top-auto h-[42%]"
        viewBox="0 0 1200 360"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line className="baseline" x1="0" y1="320" x2="1200" y2="320" />
        <path d={TRACE} />
      </svg>

      <div className="mx-auto max-w-6xl px-6 pb-28 pt-24 md:pb-40 md:pt-36">
        <p className="eyebrow reveal reveal-1">Research use only · COA-verified</p>
        <h1 className="font-display reveal reveal-2 mt-5 max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-tight md:text-7xl">
          Research-grade peptides,
          <span className="text-mute"> on the record.</span>
        </h1>
        <p className="reveal reveal-3 mt-6 max-w-xl text-base leading-relaxed text-mute md:text-lg">
          Lyophilized compounds for the bench — every lot backed by a
          certificate of analysis, purity verified by HPLC, provenance you can
          check. This storefront runs headless on the dsco commerce API.
        </p>
        <div className="reveal reveal-4 mt-9 flex flex-wrap items-center gap-5">
          <Link
            href="/search"
            className="group inline-flex items-center gap-2 rounded-full bg-reagent px-6 py-3 text-sm font-semibold text-ink transition hover:bg-reagent-deep"
          >
            Browse the catalog
            <span aria-hidden className="transition group-hover:translate-x-0.5">
              &rarr;
            </span>
          </Link>
          <Link
            href="/search"
            className="link-reagent data text-xs uppercase tracking-widest text-paper"
          >
            View certificates
          </Link>
        </div>

        {/* Mono readout ticker — the technical facts as lab data. */}
        <dl className="reveal reveal-4 mt-16 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-6 border-t border-ink-line pt-8 sm:grid-cols-4">
          {[
            ["Purity", "≥99% HPLC"],
            ["Lots", "COA per batch"],
            ["Provenance", "On-chain seal"],
            ["Use", "In-vitro only"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="eyebrow text-mute-deep">{k}</dt>
              <dd className="data mt-1 text-sm text-paper">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
