import Link from "next/link";

import FooterMenu from "components/layout/footer-menu";
import { getMenu } from "lib/flightdeck";
import { Suspense } from "react";

const { COMPANY_NAME, SITE_NAME } = process.env;

export default async function Footer() {
  const currentYear = new Date().getFullYear();
  const copyrightDate = 2026 + (currentYear > 2026 ? `-${currentYear}` : "");
  const skeleton = "w-full h-6 animate-pulse rounded-sm bg-ink-line";
  const menu = await getMenu("next-js-frontend-footer-menu");
  const copyrightName = COMPANY_NAME || SITE_NAME || "";

  return (
    <footer className="border-t border-ink-line bg-ink text-sm text-mute">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:flex-row md:gap-16">
        <div className="max-w-xs">
          <Link className="flex items-center gap-2.5" href="/">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-reagent shadow-[0_0_10px_var(--color-reagent)]"
            />
            <span className="font-display text-sm font-semibold tracking-tight text-paper">
              RUO&nbsp;<span className="text-reagent">Pro</span>
            </span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-mute-deep">
            Research-grade compounds with a certificate of analysis on every
            lot. A headless storefront running on the dsco commerce API.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex h-[188px] w-[200px] flex-col gap-2">
              <div className={skeleton} />
              <div className={skeleton} />
              <div className={skeleton} />
            </div>
          }
        >
          <FooterMenu menu={menu} />
        </Suspense>
        <div className="md:ml-auto">
          <a
            className="data inline-flex h-9 items-center gap-2 border border-ink-line px-3 text-xs uppercase tracking-widest text-mute transition-colors hover:border-reagent/60 hover:text-paper"
            href="https://github.com/DSCO-Co/nextjs-commerce"
          >
            View the source
          </a>
        </div>
      </div>
      <div className="border-t border-ink-line py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1 px-6 md:flex-row">
          <p className="data text-xs text-mute-deep">
            &copy; {copyrightDate} {copyrightName}. Research use only.
          </p>
          <p className="data text-xs text-mute-deep">
            Powered by dsco &middot; @dscodotco/sdk
          </p>
        </div>
      </div>
    </footer>
  );
}
