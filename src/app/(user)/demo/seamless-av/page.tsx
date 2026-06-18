// src/app/(user)/demo/seamless-av/page.tsx

import { Main, PageTitle, Para } from "@/components/TextBlocks";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";

import { SeamlessAvDemo } from "./_components/SeamlessAvDemo";

export const metadata = {
  title: "Seamless A/V デモ",
};

export default function SeamlessAvDemoPage() {
  return (
    <Main padding="xl">
      <Stack space={6}>
        <Stack space={2}>
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
  );
}
