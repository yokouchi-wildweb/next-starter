import Link from "next/link";

export const NavigationBrand = () => (
  <Link href="/" className="flex items-center gap-2.5 text-base font-semibold">
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-primary-foreground">
      UX
    </span>
    <span className="text-sm tracking-wide">Experience Demo</span>
  </Link>
);
