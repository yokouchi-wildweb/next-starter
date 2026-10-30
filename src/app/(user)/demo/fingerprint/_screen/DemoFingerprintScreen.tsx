// src/app/(user)/demo/fingerprint/_screen/DemoFingerprintScreen.tsx
// /demo/fingerprint(デモ)の既定画面。

import type { ScreenProps } from "@/lib/screens/types";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Main, PageTitle, Para } from "@/components/TextBlocks";

import { FingerprintDemo } from "./FingerprintDemo";

import { loadDemoFingerprintScreen } from "./loader";

export async function DemoFingerprintScreen(props: ScreenProps) {
  await loadDemoFingerprintScreen(props);

  return (
    <Main containerType="contentShell">
      <Section>
        <Stack space={4}>
          <PageTitle size="xxl" className="font-semibold">
            Fingerprint デモ
          </PageTitle>
          <Para tone="muted" size="sm">
            ブラウザフィンガープリント基盤（<code>src/lib/fingerprint</code>）の動作確認用デモです。
            デバイス信号の収集とフォーム操作の行動計測はすべてブラウザ内で完結するため、
            ログインや機能フラグの有効化なしにその場で試せます。サーバー送信のみ認証と
            <code>FINGERPRINT_CONFIG</code> の有効化が必要です。
          </Para>
        </Stack>
      </Section>

      <FingerprintDemo />
    </Main>
  );
}
