// src/domains/core/messaging/channels/email/genericView.tsx
//
// メールの送信チャンネルの汎用の描き方(D124 の 2 段目)と要約からの描き方(3 段目)。レイアウトにメールの描き方が無い時に使う。
// - 汎用: レイアウトの欄を宣言の順に、欄の型とブロックの語彙(lib/messaging)ごとに lib/mail の部品で描く
// - 要約: 題・本文・画像・行き先のボタン
// 画像の値(storage:// の参照)は表示できる URL にしてから描く(toStorageDisplaySrc)。見た目の細部は後の区切りで詰める

import type { ReactElement, ReactNode } from "react";

import {
  MailButton,
  MailDivider,
  MailFrame,
  MailHeading,
  MailImage,
  MailInfoBox,
  MailList,
  MailNote,
  MailParagraph,
  MailUrl,
  type MailTheme,
} from "@/lib/mail";
import type {
  MessageBlock,
  MessageFieldShape,
  MessageLayoutFields,
  MessageLayoutSummary,
  MessageLayoutValues,
} from "@/lib/messaging";
import { toStorageDisplaySrc } from "@/lib/storage";

type Common = { theme: MailTheme; unsubscribeUrl?: string };

function imageSrc(value: unknown): string | null {
  return typeof value === "string" ? toStorageDisplaySrc(value) : null;
}

function Block({ block, theme }: { block: MessageBlock; theme: MailTheme }): ReactElement | null {
  switch (block.type) {
    case "heading":
      return <MailHeading theme={theme}>{block.text}</MailHeading>;
    case "paragraph":
      return (
        <MailParagraph theme={theme} preWrap>
          {block.text}
        </MailParagraph>
      );
    case "button":
      return (
        <MailButton theme={theme} href={block.url}>
          {block.label}
        </MailButton>
      );
    case "image": {
      const src = imageSrc(block.src);
      return src ? <MailImage src={src} alt={block.alt} /> : null;
    }
    case "divider":
      return <MailDivider theme={theme} />;
    case "keyValueTable":
      return <MailInfoBox theme={theme} rows={block.rows.map((row) => ({ label: row.key, value: row.value }))} />;
    case "bulletList":
      return <MailList theme={theme} items={block.items} />;
  }
}

/** 欄 1 つを型で描く(値の無い欄は描かない) */
function Field({ shape, value, theme }: { shape: MessageFieldShape; value: unknown; theme: MailTheme }): ReactNode {
  if (value === undefined || value === null || value === "") return null;
  switch (shape.type) {
    case "line":
      return <MailHeading theme={theme}>{String(value)}</MailHeading>;
    case "paragraph":
    case "longText":
    case "date":
    case "number":
    case "select":
      return (
        <MailParagraph theme={theme} preWrap>
          {String(value)}
        </MailParagraph>
      );
    case "image": {
      const src = imageSrc(value);
      return src ? <MailImage src={src} /> : null;
    }
    case "button": {
      const button = value as { label: string; url: string };
      return (
        <MailButton theme={theme} href={button.url}>
          {button.label}
        </MailButton>
      );
    }
    case "link": {
      const link = value as { label?: string; url: string };
      return (
        <MailParagraph theme={theme}>
          <MailUrl theme={theme} href={link.url}>
            {link.label ?? link.url}
          </MailUrl>
        </MailParagraph>
      );
    }
    case "keyValue":
      return <MailInfoBox theme={theme} rows={(value as { key: string; value: string }[]).map((row) => ({ label: row.key, value: row.value }))} />;
    case "blocks":
      return (value as MessageBlock[]).map((block, index) => <Block key={index} block={block} theme={theme} />);
    case "list":
      return (value as unknown[]).map((item, index) => <Field key={index} shape={shape.of} value={item} theme={theme} />);
    case "group":
      return Object.entries(shape.fields).map(([key, child]) => (
        <Field key={key} shape={child} value={(value as Record<string, unknown>)[key]} theme={theme} />
      ));
  }
}

function Unsubscribe({ theme, unsubscribeUrl }: Common) {
  if (!unsubscribeUrl) return null;
  return (
    <MailNote theme={theme} align="center">
      この種類のメールが不要な場合は <MailUrl theme={theme} href={unsubscribeUrl}>配信停止</MailUrl> できます。
    </MailNote>
  );
}

/** 汎用の描き方: 欄を宣言の順に描く */
export function GenericEmailView({ fields, values, theme, unsubscribeUrl }: Common & { fields: MessageLayoutFields; values: MessageLayoutValues }) {
  return (
    <MailFrame theme={theme}>
      {Object.entries(fields).map(([key, spec]) => (
        <Field key={key} shape={spec} value={(values as Record<string, unknown>)[key]} theme={theme} />
      ))}
      <Unsubscribe theme={theme} unsubscribeUrl={unsubscribeUrl} />
    </MailFrame>
  );
}

/** 要約からの描き方: 題・本文・画像・行き先 */
export function SummaryEmailView({ summary, theme, unsubscribeUrl }: Common & { summary: MessageLayoutSummary }) {
  const src = imageSrc(summary.image);
  return (
    <MailFrame theme={theme} preview={summary.shortBody}>
      <MailHeading theme={theme}>{summary.title}</MailHeading>
      {src ? <MailImage src={src} /> : null}
      <MailParagraph theme={theme} preWrap>
        {summary.body}
      </MailParagraph>
      {summary.link ? (
        <MailButton theme={theme} href={summary.link.url}>
          {summary.link.label ?? "詳しく見る"}
        </MailButton>
      ) : null}
      <Unsubscribe theme={theme} unsubscribeUrl={unsubscribeUrl} />
    </MailFrame>
  );
}
