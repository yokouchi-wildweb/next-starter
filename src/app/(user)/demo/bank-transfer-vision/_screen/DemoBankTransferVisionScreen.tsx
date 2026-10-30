// src/app/(user)/demo/bank-transfer-vision/_screen/DemoBankTransferVisionScreen.tsx
// /demo/bank-transfer-vision(デモ)の既定画面。

import type { ScreenProps } from "@/lib/screens/types";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Main, PageTitle, Para } from "@/components/TextBlocks";

import { BankTransferVisionDemo } from "../BankTransferVisionDemo";

import { loadDemoBankTransferVisionScreen } from "./loader";

export async function DemoBankTransferVisionScreen(props: ScreenProps) {
  await loadDemoBankTransferVisionScreen(props);

  return (
    <Main containerType="contentShell">
      <Section>
        <Stack space={4}>
          <PageTitle size="xxl" className="font-semibold">
            Bank Transfer Vision
          </PageTitle>
          <Para tone="muted" size="sm">
            画像をアップロードすると、Claude Haiku 4.5 が「銀行振込明細の写真」または「ネットバンクの振込完了画面」のいずれかに見えるかを判定します。
            金額や振込先の検証は行わない、ざっくりとした仮判定用途のサンプルです。
          </Para>
        </Stack>
      </Section>

      <Section>
        <BankTransferVisionDemo />
      </Section>
    </Main>
  );
}
