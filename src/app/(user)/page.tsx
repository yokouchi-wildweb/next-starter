import { Block } from "@/components/Layout/Block";

export const dynamic = "force-dynamic";

import type { ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Main, PageTitle, Para, Section, Span } from "@/components/TextBlocks";
import { CosmicCoasterScene } from "@/components/Three/CosmicCoasterScene";


const quickStartSteps: Array<{ id: string; description: ReactNode }> = [
  {
    id: 1,
    description: <>Get started by editing `src/app/(user)/page.tsx`.</>,
  },
  {
    id: 2,
    description: <>Save and see your changes instantly.</>,
  },
];

const pageLinks = [
  { href: "/admin", label: "管理ダッシュボード" },
  { href: "/signup", label: "サインアップ" },
  { href: "/login", label: "ログイン" },
  { href: "/demo/form-components/", label: "フォームDEMO" },
  { href: "/demo/loading-overlay/", label: "ローディングDEMO" },
];

const resourceLinks = [
  {
    href: "https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app",
    label: "Docs",
    icon: { src: "/file.svg", alt: "Docs" },
  },
  {
    href: "https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app",
    label: "Templates",
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
      <CosmicCoasterScene />
      <Main variant="wideShowcase" className="relative z-10 min-h-screen text-slate-900">
        <Flex direction="column" gap="xl" className="py-20">

          <Section align="center" className="relative">
            <Flex
              variant=""
              space="none"
              direction="column"
              align="center"
              gap="lg"
              className="mx-auto text-center"
            >
              <Image src="/next.svg" alt="Next.js" width={400} height={208} priority />
              <PageTitle variant="prominent">next-starter >>> a Wildweb creation.</PageTitle>
            </Flex>
          </Section>

          <Section className="text-center">
            <Block
              variant="raised"
              className="inline-block w-[72%] rounded-3xl border border-white/60 bg-white/39 p-6 backdrop-blur"
            >
              {quickStartSteps.map((step) => (
                <Para key={step.id} size="lead" className="text-center text-slate-700">
                  {step.id}. {step.description}
                </Para>
              ))}
            </Block>
          </Section>

          <Section as="nav">
            <Flex
              variant=""
              space="none"
              wrap="wrap"
              gap="lg"
              justify="center"
              className="mx-auto"
            >
              {pageLinks.map((link) => (
                <Button
                  key={link.href}
                  asChild
                  variant="accent"
                  size="lg"
                  style={{ flex: "1 1 30%", minWidth: "200px", height: "64px", fontSize: "1.125rem" }}
                >
                  <Link href={link.href}>{link.label}</Link>
                </Button>
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
                    <Flex as="span" align="center" gap="sm">
                      <Image src={resource.icon.src} alt={resource.icon.alt} width={20} height={20} />
                      <Span size="sm">{resource.label}</Span>
                    </Flex>
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
