import CartModal from "components/cart/modal";
import { getMenu } from "lib/flightdeck";
import { Menu } from "lib/flightdeck/types";
import Link from "next/link";
import { Suspense } from "react";
import MobileMenu from "./mobile-menu";
import Search, { SearchSkeleton } from "./search";

const { SITE_NAME } = process.env;

export async function Navbar() {
  const menu = await getMenu("next-js-frontend-header-menu");

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-ink-line bg-ink/80 px-6 py-4 backdrop-blur-md">
      <div className="block flex-none md:hidden">
        <Suspense fallback={null}>
          <MobileMenu menu={menu} />
        </Suspense>
      </div>
      <div className="flex w-full items-center">
        <div className="flex w-full items-center md:w-1/3">
          <Link
            href="/"
            prefetch={true}
            className="mr-6 flex items-center gap-2.5"
            aria-label={SITE_NAME}
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-reagent shadow-[0_0_10px_var(--color-reagent)]"
            />
            <span className="font-display text-sm font-semibold tracking-tight">
              RUO&nbsp;<span className="text-reagent">Pro</span>
            </span>
          </Link>
          {menu.length ? (
            <ul className="hidden items-center gap-6 md:flex">
              {menu.map((item: Menu) => (
                <li key={item.title}>
                  <Link
                    href={item.path}
                    prefetch={true}
                    className="data text-xs uppercase tracking-widest text-mute transition-colors hover:text-paper"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="hidden justify-center md:flex md:w-1/3">
          <Suspense fallback={<SearchSkeleton />}>
            <Search />
          </Suspense>
        </div>
        <div className="flex justify-end md:w-1/3">
          <CartModal />
        </div>
      </div>
    </nav>
  );
}
