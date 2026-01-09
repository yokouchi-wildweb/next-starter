// src/features/auth/components/VerificationEmailSent/index.tsx

// 認証メール送信完了後に表示するメッセージセクションです。

import { Section } from "@/components/Layout/Section";
import { Para, SecTitle } from "@/components/TextBlocks";

export function VerificationEmailSent() {
  return (
    <Section id="verification-email-sent">
      <Para size="sm">
        認証用のリンクを送信しました。受信メールをご確認のうえ、本登録を完了してください。
      </Para>
      <Para tone="muted">
        メールが届かない場合は、迷惑メールフォルダをご確認ください。
      </Para>
    </Section>
  );
}
