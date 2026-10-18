// src/app/(user)/_screen/StarterHome/Capabilities.tsx
// 「最初から入っているもの」のコンパクトなカードグリッド。1 画面に収めるため縦方向を詰めている。

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Para, SecTitle, Span } from "@/components/TextBlocks";

import { CAPABILITIES } from "./capabilities";

export function Capabilities() {
  return (
    <Section aria-labelledby="starter-capabilities">
      <Stack space={3}>
        <SecTitle
          id="starter-capabilities"
          size="xs"
          weight="medium"
          tone="muted"
          align="center"
          className="uppercase tracking-[0.2em]"
        >
          最初から入っているもの
        </SecTitle>

        <Grid gap="sm" className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ key, icon: Icon, title, description }) => (
            <Block
              key={key}
              className="rounded-xl border bg-card/70 p-4 backdrop-blur transition-colors duration-200 hover:border-foreground/20"
            >
              <Stack space={1.5}>
                <Flex align="center" gap="xs">
                  <Flex
                    align="center"
                    justify="center"
                    className="size-7 shrink-0 rounded-md bg-muted text-foreground"
                  >
                    <Icon aria-hidden="true" className="size-3.5" />
                  </Flex>
                  <Span size="sm" weight="semiBold">
                    {title}
                  </Span>
                </Flex>
                <Para size="sm" tone="muted" className="my-0 leading-snug">
                  {description}
                </Para>
              </Stack>
            </Block>
          ))}
        </Grid>
      </Stack>
    </Section>
  );
}
