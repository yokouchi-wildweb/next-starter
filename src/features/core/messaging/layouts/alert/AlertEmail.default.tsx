// src/features/core/messaging/layouts/alert/AlertEmail.default.tsx
// レイアウト「セキュリティの警告」のメールの既定の見た目(前の auth の accountLocked の描き方と同じ部品の並び):
//   見出し → 説明 → 情報の箱(値が空の行は出さない)→ 心当たりがない場合 → ある場合(最初の行を太字)→ 末尾の注意書き(→ 停止のリンク)
// 値の無い欄は描かない

import {
  MailFooter,
  MailFrame,
  MailHeading,
  MailInfoBox,
  MailNote,
  MailParagraph,
  MailUrl,
  type MailTheme,
} from "@/lib/mail";
import type { MessageLayoutSummary } from "@/lib/messaging";

import { splitFirstLine, visibleDetails, type AlertValues } from "./layout";

export type AlertEmailProps = {
  values: AlertValues;
  summary: MessageLayoutSummary;
  theme: MailTheme;
  /** 配信停止のリンク(好みに従う連絡だけ) */
  unsubscribeUrl?: string;
};

function Notice({ text, theme }: { text: string; theme: MailTheme }) {
  const { first, rest } = splitFirstLine(text);
  return (
    <MailParagraph theme={theme}>
      <strong>{first}</strong>
      {rest !== null ? (
        <>
          <br />
          {rest}
        </>
      ) : null}
    </MailParagraph>
  );
}

export function AlertEmail({ values, theme, unsubscribeUrl }: AlertEmailProps) {
  const { preheader, heading, explanation, notYou, ifYou, footer } = values;
  const rows = visibleDetails(values).map((row) => ({ label: row.key, value: row.value }));
  return (
    <MailFrame theme={theme} preview={preheader}>
      {heading ? <MailHeading theme={theme}>{heading}</MailHeading> : null}
      {explanation ? <MailParagraph theme={theme}>{explanation}</MailParagraph> : null}
      {rows.length > 0 ? <MailInfoBox theme={theme} rows={rows} /> : null}
      {notYou ? <Notice text={notYou} theme={theme} /> : null}
      {ifYou ? <Notice text={ifYou} theme={theme} /> : null}
      {footer ? <MailFooter theme={theme}>{footer}</MailFooter> : null}
      {unsubscribeUrl ? (
        <MailNote theme={theme} align="center">
          この種類のメールが不要な場合は <MailUrl theme={theme} href={unsubscribeUrl}>配信停止</MailUrl> できます。
        </MailNote>
      ) : null}
    </MailFrame>
  );
}
