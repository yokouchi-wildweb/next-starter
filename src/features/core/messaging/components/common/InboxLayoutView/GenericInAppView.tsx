// src/features/core/messaging/components/common/InboxLayoutView/GenericInAppView.tsx
// 部品(props だけ): お知らせの汎用の描き方(描き方の 3 段の 2 段目)。ひな形にお知らせの描き方が無い時、ひな形の欄の宣言の順に
// 欄の型(lib/messaging の語彙)とブロックの種類ごとに components の部品で描く(生の HTML は使わない)。
// 値の無い欄は描かない。画像は保存値のまま AppImage へ(storage:// の参照を表示用にする)

import type { ReactNode } from "react";

import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import { AppImage } from "@/components/Media/AppImage";
import { Link } from "@/components/Navigation";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import type { MessageBlock, MessageFieldShape, MessageLayoutFields, MessageLayoutValues } from "@/lib/messaging";

export type GenericInAppViewProps = {
  /** ひな形のお知らせの欄の宣言(宣言の順に描く) */
  fields: MessageLayoutFields;
  values: MessageLayoutValues;
};

function FieldImage({ src, alt }: { src: string; alt?: string }) {
  return <AppImage src={src} alt={alt ?? ""} sizes="card" objectFit="contain" className="aspect-video w-full rounded-md bg-muted" />;
}

function ButtonLink({ label, url }: { label: string; url: string }) {
  return (
    <Flex justify="center">
      <LinkButton href={url} variant="outline">
        {label}
      </LinkButton>
    </Flex>
  );
}

function KeyValueRows({ rows }: { rows: readonly { key: string; value: string }[] }) {
  return (
    <Grid className="grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted p-3" data-slot="inbox-key-value">
      {rows.flatMap((row, index) => [
        <Para key={`k${index}`} size="sm" tone="muted">
          {row.key}
        </Para>,
        <Para key={`v${index}`} size="sm" className="break-words">
          {row.value}
        </Para>,
      ])}
    </Grid>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <Stack gap="2xs" data-slot="inbox-bullets">
      {items.map((item, index) => (
        <Para key={index} className="break-words">
          ・{item}
        </Para>
      ))}
    </Stack>
  );
}

function Text({ children }: { children: ReactNode }) {
  return <Para className="whitespace-pre-wrap break-words">{children}</Para>;
}

/** ブロック 1 つ(ブロックの並びの欄) */
export function InboxBlock({ block }: { block: MessageBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <SecTitle as="h3" size="md">
          {block.text}
        </SecTitle>
      );
    case "paragraph":
      return <Text>{block.text}</Text>;
    case "button":
      return <ButtonLink label={block.label} url={block.url} />;
    case "image":
      return <FieldImage src={block.src} alt={block.alt} />;
    case "divider":
      return <Block className="border-t border-border" data-slot="inbox-divider" />;
    case "keyValueTable":
      return <KeyValueRows rows={block.rows} />;
    case "bulletList":
      return <Bullets items={block.items} />;
  }
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/** 欄 1 つを型で描く(値の無い欄は描かない) */
function Field({ shape, value }: { shape: MessageFieldShape; value: unknown }): ReactNode {
  if (isEmpty(value)) return null;
  switch (shape.type) {
    case "line":
      return (
        <SecTitle as="h3" size="md">
          {String(value)}
        </SecTitle>
      );
    case "paragraph":
    case "longText":
    case "date":
    case "number":
      return <Text>{String(value)}</Text>;
    case "select": {
      const option = shape.options.find((item) => item.value === value);
      return <Text>{option?.label ?? String(value)}</Text>;
    }
    case "image":
      return typeof value === "string" ? <FieldImage src={value} alt="" /> : null;
    case "button": {
      const button = value as { label: string; url: string };
      return <ButtonLink label={button.label} url={button.url} />;
    }
    case "link": {
      const link = value as { label?: string; url: string };
      return (
        <Para>
          <Link href={link.url} className="underline">
            {link.label ?? link.url}
          </Link>
        </Para>
      );
    }
    case "keyValue":
      return <KeyValueRows rows={value as { key: string; value: string }[]} />;
    case "blocks":
      return (
        <Stack gap="sm">
          {(value as MessageBlock[]).map((block, index) => (
            <InboxBlock key={index} block={block} />
          ))}
        </Stack>
      );
    case "list": {
      const items = value as unknown[];
      // 文字の並びは箇条書き、ほかは型ごとに縦に並べる
      if (shape.of.type === "line" || shape.of.type === "paragraph" || shape.of.type === "longText") {
        return <Bullets items={items.map(String)} />;
      }
      return (
        <Stack gap="xs">
          {items.map((item, index) => (
            <Field key={index} shape={shape.of} value={item} />
          ))}
        </Stack>
      );
    }
    case "group":
      return (
        <Stack gap="xs">
          {Object.entries(shape.fields).map(([key, child]) => (
            <Field key={key} shape={child} value={(value as Record<string, unknown>)[key]} />
          ))}
        </Stack>
      );
  }
}

export function GenericInAppView({ fields, values }: GenericInAppViewProps) {
  return (
    <Stack gap="sm" data-slot="inbox-generic">
      {Object.entries(fields).map(([key, spec]) => (
        <Field key={key} shape={spec} value={(values as Record<string, unknown>)[key]} />
      ))}
    </Stack>
  );
}
