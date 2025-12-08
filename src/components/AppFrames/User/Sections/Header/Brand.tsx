import Link from "next/link";

export const Brand = () => (
  <Link
    href="/public"
    className="flex items-center gap-2.5 text-base font-semibold sm:gap-3 sm:text-lg"
  >
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-primary-foreground sm:h-10 sm:w-10 sm:text-sm">
      UX
    </span>
    <span className="text-sm tracking-wide sm:text-base">Experience Demo</span>
  </Link>
);
