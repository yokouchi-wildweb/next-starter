import Link from "next/link";

export const NavigationBrand = () => (
  <Link href="/" className="flex items-center gap-3 text-lg font-semibold">
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground">
      UX
    </span>
    <span className="tracking-wide">Experience Demo</span>
  </Link>
);
