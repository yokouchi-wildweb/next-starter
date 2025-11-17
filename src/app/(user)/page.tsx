import { Block } from "@/components/Layout/Block";

export const dynamic = "force-dynamic";

import type { ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Main, PageTitle, Para, Span } from "@/components/TextBlocks";
import { CosmicCoasterScene } from "@/components/Three/CosmicCoasterScene";
import FullScreen from "@/components/Layout/FullScreen";
import { FuturisticNavButton } from "./_components/FuturisticNavButton";


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
  { href: "/demo/block-appearance/", label: "ブロック外観DEMO", alertIfAuthenticated: false },
];

const resourceLinks = [
  {
    href: "https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app",
    label: "Docs",
    icon: { src: "/file.svg", alt: "Docs" },
  },
  {
    href: "https://wildweb.tokyo",
    label: "Wildweb.tokyo",
    icon: { src: "/window.svg", alt: "Templates" },
  },
  {
    href: "https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app",
    label: "Next.js",
    icon: { src: "/globe.svg", alt: "Next.js" },
  },
];

export default function Home() {
  return (
    <>
      <FullScreen layer="background" disableScroll={false}>
        <CosmicCoasterScene />
      </FullScreen>

      <Main
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
              <Image src="/next.svg" alt="Next.js" className="drop-shadow-[6px_6px_9px_rgba(84,205,233,0.25)]" width={400} height={208} priority />
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
      </Main>
    </>
  );
}
