// src/features/core/messaging/components/common/SendLegalNotice/index.tsx
// 部品(props だけ): 送るモーダルの法の義務の告知の注意(D83)。いつも出し、メールがオンの経路に無ければ警告の色。送るのは止めない
// (告知かどうかはモーダルが知らない)。全員宛てのお知らせは配達の行を持たず、届かなかった人を数えられないため

"use client";

import { Para } from "@/components/TextBlocks/Para";

export const SEND_LEGAL_NOTICE_TEXT =
  "法の義務で必ず届ける告知は、経路にメールを含めてください(全員宛てのお知らせは配達の記録を持たず、届かなかった人を確かめられません)";

export type SendLegalNoticeProps = {
  /** メールがオンの経路にあるか */
  emailOn: boolean;
};

export function SendLegalNotice({ emailOn }: SendLegalNoticeProps) {
  return (
    <Para size="xs" tone={emailOn ? "muted" : "warning"} className="my-0">
      {SEND_LEGAL_NOTICE_TEXT}
    </Para>
  );
}
