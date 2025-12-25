'use client';

import type { MouseEvent, ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { PageTitle, Para, Span } from "@/components/TextBlocks";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { CosmicCoasterScene } from "@/components/Three/CosmicCoasterScene";
import FullScreen from "@/components/Layout/FullScreen";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { cn } from "@/lib/cn";
import { Block } from "@/components/Layout/Block";
import { iconPath } from "@/utils/assets";

export const dynamic = "force-dynamic";


const quickStartSteps: Array<{ id: string; description: ReactNode }> = [
  {
    id: "1",
    description: <>Get started by editing `src/app/(user)/page.tsx`.</>,
  },
  {
    id: "2",
    description: <>Save and see your changes instantly.</>,
  },
];

const pageLinks = [
  { href: "/admin", label: "管理ダッシュボード", alertIfAuthenticated: false },
  { href: "/signup", label: "サインアップ", alertIfAuthenticated: true },
  { href: "/login", label: "ログイン", alertIfAuthenticated: true },
  { href: "/demo/form-components/", label: "フォームDEMO", alertIfAuthenticated: false },
  { href: "/demo/overlay/", label: "オーバーレイDEMO", alertIfAuthenticated: false },
  { href: "/demo/tables/", label: "テーブルスイートDEMO", alertIfAuthenticated: false },
];

const resourceLinks = [
  {
    href: "https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app",
    label: "Docs",
    icon: { src: iconPath("file.svg"), alt: "Docs" },
  },
  {
    href: "https://wildweb.tokyo",
    label: "Wildweb.tokyo",
    icon: { src: iconPath("window.svg"), alt: "Templates" },
  },
  {
    href: "https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app",
    label: "Next.js",
    icon: { src: iconPath("globe.svg"), alt: "Next.js" },
  },
];

type FuturisticNavButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
  alertIfAuthenticated?: boolean;
};

function FuturisticNavButton({
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

export default function Home() {
  return (
    <>
      <FullScreen layer="background" disableScroll={false}>
        <CosmicCoasterScene />
      </FullScreen>

      <UserPage
        containerType="contentShell"
        className="relative content-layer text-slate-900"
      >
        <Flex direction="column" gap="xxl" className="py-20">

          <Section className="relative text-center">
            <Flex
              space="none"
              direction="column"
              align="center"
              gap="lg"
              className="mx-auto text-center"
            >
              <Image src={iconPath("next.svg")} alt="Next.js" className="drop-shadow-[6px_6px_9px_rgba(84,205,233,0.25)]" width={400} height={208} priority />
              <PageTitle className="text-3xl font-bold text-shadow-[6px_6px_6px_rgba(84,205,233,0.2)]">next-starter &gt;&gt;&gt; a Wildweb creation.</PageTitle>
            </Flex>
          </Section>

          <Section className="text-center">
              <Block
                appearance="raised"
                className="inline-block w-[72%] rounded-3xl border border-white/60 bg-white/39 p-6 backdrop-blur"
              >
              {quickStartSteps.map((step) => (
                <Para key={step.id} size="lg" className="text-center text-slate-700">
                  {step.id}. {step.description}
                </Para>
              ))}
            </Block>
          </Section>

          <Section as="nav">
            <Flex
              space="none"
              wrap="wrap"
              gap="lg"
              justify="center"
              className="mx-auto"
            >
              {pageLinks.map((link) => (
                <FuturisticNavButton
                  key={link.href}
                  href={link.href}
                  alertIfAuthenticated={link.alertIfAuthenticated}
                  className="basis-full sm:basis-[48%] lg:basis-[30%]"
                >
                  {link.label}
                </FuturisticNavButton>
              ))}
            </Flex>
          </Section>

          <Section>
            <Flex
              direction="columnToRowSm"
              gap="lg"
              wrap="wrap"
              justify="center"
              align="center"
              className="mx-auto"
            >
              {resourceLinks.map((resource) => (
                <Button key={resource.href} asChild variant="outline" size="sm">
                  <Link href={resource.href} target="_blank">
                    <Image src={resource.icon.src} alt={resource.icon.alt} width={20} height={20} />
                    <Span size="sm">{resource.label}</Span>
                  </Link>
                </Button>
              ))}
            </Flex>
          </Section>
        </Flex>
      </UserPage>
    </>
  );
}
