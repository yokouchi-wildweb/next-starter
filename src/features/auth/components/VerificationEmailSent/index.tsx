// src/features/auth/components/VerificationEmailSent/index.tsx

// 認証メール送信完了後に表示するメッセージセクションです。

import { Section } from "@/components/Layout/Section";
import { Para, SecTitle } from "@/components/TextBlocks";
import { Block } from "@/components/Layout/Block";

export function VerificationEmailSent() {
  return (
    <Section id="verification-email-sent">
      <SecTitle variant="emphasis" as="h2">
        受信メールをご確認ください
      </SecTitle>
      <Para size="sm">
        入力いただいたメールアドレス宛に認証用のリンクを送信しました。メールをご確認のうえ、リンクから本登録を完了してください。
      </Para>
      <Para tone="muted">
        メールが届かない場合は、迷惑メールフォルダを確認するか、時間をおいて再度お試しください。
      </Para>
    </Section>
  );
}
