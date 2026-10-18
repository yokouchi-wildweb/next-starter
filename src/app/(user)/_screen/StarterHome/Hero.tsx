// src/app/(user)/_screen/StarterHome/Hero.tsx

import { ArrowRight } from "lucide-react";

import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { PageTitle, Para, Span } from "@/components/TextBlocks";
import { businessConfig } from "@/config/business.config";

type HeroProps = {
  /** デモ機能が有効なときだけ「デモを見る」を出す */
  showDemoLink: boolean;
};

export function Hero({ showDemoLink }: HeroProps) {
  return (
    <Section>
      <Stack space={6} className="items-center text-center">
        <Span
          size="xs"
          weight="medium"
          tone="muted"
          className="inline-flex items-center rounded-full border bg-background/60 px-3 py-1 tracking-[0.18em] uppercase backdrop-blur"
        >
          Next.js 16 · React 19 · App Router
        </Span>

        <Stack space={3} className="items-center">
          <PageTitle
            align="center"
            className="text-4xl font-semibold tracking-tighter text-balance sm:text-5xl lg:text-6xl"
          >
            {businessConfig.serviceName}
          </PageTitle>
          <Para
            tone="muted"
            align="center"
            className="my-0 max-w-xl text-balance sm:text-lg"
          >
            必要な材料は全てここに。
            <br />
            実装のみに集中できる Next.js 開発基盤。
          </Para>
        </Stack>

        <Flex direction="columnToRowSm" gap="xs" justify="center" className="w-full sm:w-auto">
          {showDemoLink && (
            <LinkButton href="/demo" size="lg" className="group gap-2">
              デモを見る
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </LinkButton>
          )}
          <LinkButton href="/admin" variant="outline" size="lg">
            管理画面
          </LinkButton>
        </Flex>
      </Stack>
    </Section>
  );
}
