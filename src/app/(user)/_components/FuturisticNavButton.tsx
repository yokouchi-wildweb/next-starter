"use client";

import type { MouseEvent, ReactNode } from "react";

import Link from "next/link";

import { Button } from "@/components/Form/Button/Button";
import { Span } from "@/components/TextBlocks";
import { useAuthSession } from "@/features/auth/hooks/useAuthSession";
import { cn } from "@/lib/cn";

type FuturisticNavButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
  alertIfAuthenticated?: boolean;
};

export function FuturisticNavButton({
  href,
  children,
  className,
  alertIfAuthenticated,
}: FuturisticNavButtonProps) {
  const { isAuthenticated } = useAuthSession();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!alertIfAuthenticated || !isAuthenticated) {
      return;
    }

    event.preventDefault();
    window.alert("既にログイン済みです。再ログインするにはログアウトしてください。");
  };

  return (
    <Button
      asChild
      variant="mutedIcon"
      size="lg"
      className={cn(
        "group relative inline-flex h-16 w-full min-w-[220px] flex-1 items-center justify-between overflow-hidden rounded-2xl border border-slate-300/60 bg-gradient-to-br from-slate-100/75 via-slate-200/40 to-slate-300/30 px-6 text-slate-800 shadow-[0_30px_90px_-55px_rgba(15,23,42,0.95)] backdrop-blur-sm transition-all duration-500 ease-out hover:border-slate-200/80 hover:shadow-[0_42px_120px_-70px_rgba(15,23,42,0.95)] hover:brightness-[1.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 before:pointer-events-none before:absolute before:inset-0 before:-translate-y-full before:bg-gradient-to-b before:from-white/70 before:via-transparent before:to-transparent before:opacity-0 before:transition before:duration-700 before:ease-out before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_20%_-20%,rgba(226,232,240,0.5),transparent_60%),radial-gradient(circle_at_80%_120%,rgba(148,163,184,0.35),transparent_65%)] after:opacity-0 after:transition-opacity after:duration-700 group-hover:before:translate-y-0 group-hover:before:opacity-100 group-hover:after:opacity-100",
        className,
      )}
    >
      <Link
        href={href}
        className="flex w-full items-center justify-between"
        onClick={handleClick}
      >
        <Span
          size="md"
          className="font-semibold tracking-[0.12em] text-slate-600 transition-colors duration-500 group-hover:text-slate-900"
        >
          {children}
        </Span>
        <Span
          size="sm"
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full border border-white/50 bg-white/20 text-slate-500 shadow-[inset_0_0_12px_rgba(148,163,184,0.4)] transition-all duration-500 ease-out origin-center transform-gpu group-hover:scale-[1.35] group-hover:border-slate-300/80 group-hover:bg-white/45 group-hover:text-slate-900 group-hover:shadow-[0_18px_55px_-25px_rgba(30,41,59,0.6)] group-active:scale-95"
        >
          ↗
        </Span>
      </Link>
    </Button>
  );
}
