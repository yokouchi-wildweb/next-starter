// src/app/(user)/demo/seamless-av/_screen/DemoSeamlessAvScreen.tsx
// /demo/seamless-av(デモ)の既定画面。

import { Main } from "@/components/Layout/Main";
import { PageTitle } from "@/components/TextBlocks/PageTitle";
import { Para } from "@/components/TextBlocks/Para";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { createScreen } from "@/wiring/screen";

import { SeamlessAvDemo } from "./SeamlessAvDemo";

import { loadDemoSeamlessAvScreen } from "./loader";

export const { Screen: DemoSeamlessAvScreen, generateMetadata } = createScreen({
  load: loadDemoSeamlessAvScreen,
  render: () => (
    <Main padding={{ base: "lg", sm: "2xl" }}>
      <Stack gap="lg">
        <Stack gap="xs">
          <PageTitle>Seamless A/V(音声付きフラグメント連結)</PageTitle>
          <Para tone="muted" size="sm">
            各フラグメントに「映像(fmp4)＋音声」をセットで登録し、抽選のように順番を入れ替えて連続再生するデモです。
            映像は MSE で連結、音声は Web Audio でギャップレスに連結し、両者を同期させます(方式 B)。変換は行いません。
          </Para>
        </Stack>

        <Section>
          <SeamlessAvDemo />
        </Section>
      </Stack>
    </Main>
  ),
  metadata: {
    title: "Seamless A/V デモ",
  },
});
