// src/app/(user)/demo/_screen/DemoIndexScreen.tsx
// /demo(デモ)の既定画面。

import type { ScreenProps } from "@/lib/screens/types";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Main, PageTitle, Para, SecTitle, Span } from "@/components/TextBlocks";

import { demoHref, getDemoPagesByCategory, DEMO_PAGES } from "../_data/demoPages";

import { loadDemoIndexScreen } from "./loader";

export async function DemoIndexScreen(props: ScreenProps) {
  await loadDemoIndexScreen(props);

  const groups = getDemoPagesByCategory();

  return (
    <Main containerType="contentShell">
      <Stack space={12} className="py-6 sm:py-10">
        <Section>
          <Stack space={3}>
            <Span size="xs" weight="medium" tone="muted" className="uppercase tracking-[0.2em]">
              Demo · {DEMO_PAGES.length} pages
            </Span>
            <PageTitle size="xxxl" className="font-semibold">
              デモ一覧
            </PageTitle>
            <Para tone="muted" className="my-0 max-w-2xl">
              このスターターに同梱されているコンポーネントと機能の動作確認ページです。
              カテゴリごとにまとめています。
            </Para>
          </Stack>
        </Section>

        {groups.map((group) => (
          <Section key={group.key} aria-labelledby={`demo-category-${group.key}`}>
            <Stack space={4}>
              <Flex align="center" gap="xs">
                <SecTitle id={`demo-category-${group.key}`} size="lg" weight="semiBold">
                  {group.label}
                </SecTitle>
                <Span size="xs" tone="muted" className="rounded-full border px-2 py-0.5 tabular-nums">
                  {group.pages.length}
                </Span>
              </Flex>

              <Grid gap="md" className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {group.pages.map((page) => (
                  <Link
                    key={page.path}
                    href={demoHref(page)}
                    className="group block rounded-xl border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Block>
                      <Flex align="center" justify="between" gap="xs">
                        <Span weight="medium" className="truncate">
                          {page.label}
                        </Span>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                        />
                      </Flex>
                      <Para size="sm" tone="muted" className="my-0 mt-1 line-clamp-2">
                        {page.description}
                      </Para>
                    </Block>
                  </Link>
                ))}
              </Grid>
            </Stack>
          </Section>
        ))}
      </Stack>
    </Main>
  );
}
