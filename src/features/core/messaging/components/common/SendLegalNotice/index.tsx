// src/features/core/messaging/components/common/SendLegalNotice/index.tsx
// 部品(props だけ): 送るモーダルの法の義務の告知の注意(D83)。いつも出し、メールがオンの送信チャンネルに無ければ警告の色。送るのは止めない
// (告知かどうかはモーダルが知らない)。全員宛てのお知らせは配達の行を持たず、届かなかった人を数えられないため

"use client";

import { Para } from "@/components/TextBlocks/Para";

export const SEND_LEGAL_NOTICE_TEXT =
  "法律上必ず届ける必要がある告知は、送信方法にメールを含めてください(全員宛てのお知らせは送信状況を記録しないため、届かなかった人を確認できません)";

export type SendLegalNoticeProps = {
  /** メールがオンの送信チャンネルにあるか */
  emailOn: boolean;
};

export function SendLegalNotice({ emailOn }: SendLegalNoticeProps) {
  return (
    <Para size="xs" tone={emailOn ? "muted" : "warning"} className="my-0">
      {SEND_LEGAL_NOTICE_TEXT}
    </Para>
  );
}
