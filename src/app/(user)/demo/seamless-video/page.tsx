// src/app/(user)/demo/seamless-video/page.tsx

import { Main, PageTitle, Para } from "@/components/TextBlocks";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";

import { SeamlessVideoDemo } from "./_components/SeamlessVideoDemo";

export const metadata = {
  title: "Seamless Video デモ",
};

export default function SeamlessVideoDemoPage() {
  return (
    <Main padding="xl">
      <Stack space={6}>
        <Stack space={2}>
          <PageTitle>Seamless Video(fmp4 連結再生)</PageTitle>
          <Para tone="muted" size="sm">
            統一プロファイルへ変換済みの fragmented MP4 を複数アップロードし、順番を入れ替えて、MSE で
            継ぎ目なく 1 本の映像として連結再生できるかを検証するデモです。変換(トランスコード)は行いません。
            入力フォーマット規約は src/lib/seamlessVideo/README.md を参照してください。
          </Para>
        </Stack>

        <Section>
          <SeamlessVideoDemo />
        </Section>
      </Stack>
    </Main>
  );
}
