// src/features/core/messaging/components/common/TemplateVersionList/index.tsx
// 部品(props だけ): 公開した版の一覧(新しい順)と、選んだ 1 版の中身(読むだけ。版は書き換えない)。
// 中身は欄の見出しと中身を読むだけの一覧で見せる(ひな形の表示名・欄の見出しは layouts から)

"use client";

import { useState } from "react";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

import type { MessageLayoutFields } from "@/lib/messaging";

import type { AdminTemplateVersion } from "@/features/core/messaging/services/client/templateClient";

export type TemplateVersionListProps = {
  versions: AdminTemplateVersion[];
  /** 今の公開の版(印を付ける) */
  currentVersion?: number | null;
  /** 選べるひな形(表示名と欄の見出しに使う。鍵は見せない、D46) */
  layouts?: readonly { key: string; label: string; fields: MessageLayoutFields }[];
};

/** 欄の中身を読む形に(並び・組は 1 行ずつ) */
function valueText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join("\n");
  if (value && typeof value === "object") return Object.values(value).map(valueText).filter(Boolean).join(" / ");
  return "";
}

const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
};

export function TemplateVersionList({ versions, currentVersion, layouts = [] }: TemplateVersionListProps) {
  const [opened, setOpened] = useState<number | null>(null);
  if (versions.length === 0) {
    return (
      <Para size="sm" tone="muted" className="my-0">
        公開したバージョンはまだありません
      </Para>
    );
  }
  const shown = versions.find((version) => version.version === opened) ?? null;
  const shownFields = shown ? (layouts.find((item) => item.key === shown.layout)?.fields ?? {}) : {};
  return (
    <Stack space={2} data-slot="template-version-list">
      {versions.map((version) => (
        <Flex key={version.version} align="center" justify="between" gap="sm" wrap="wrap" className="border-b border-border py-1">
          <Flex align="center" gap="sm" wrap="wrap">
            <Span size="sm" weight="semiBold">
              v{version.version}
              {version.version === currentVersion ? "(公開中)" : ""}
            </Span>
            <Span size="sm" tone="muted">
              {when(version.createdAt)}
            </Span>
            <Span size="sm" tone="muted">
              {version.categoryLabel ?? "削除されたカテゴリー"} / ひな形 {layouts.find((item) => item.key === version.layout)?.label ?? "(使えなくなったひな形)"}
            </Span>
          </Flex>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpened(opened === version.version ? null : version.version)}
          >
            {opened === version.version ? "閉じる" : "内容を見る"}
          </Button>
        </Flex>
      ))}
      {shown ? (
        <Stack space={3} className="rounded bg-muted/40 p-3">
          <Span size="sm" tone="muted">
            v{shown.version} の内容
          </Span>
          <Stack space={1} data-slot="template-version-values">
            {Object.entries(shown.values).map(([key, value]) => (
              <Stack key={key} space={0}>
                <Span size="xs" tone="muted">
                  {shownFields[key]?.label ?? key}
                </Span>
                <Para size="sm" className="my-0 whitespace-pre-wrap">
                  {valueText(value) || "-"}
                </Para>
              </Stack>
            ))}
          </Stack>
          {shown.embedded.length > 0 ? (
            <Stack space={1}>
              <Span size="sm" tone="muted">
                埋め込み情報
              </Span>
              {shown.embedded.map((declaration) => (
                <Span key={declaration.key} size="sm">
                  {declaration.alias}(<Span size="inherit" className="font-mono">{declaration.key}</Span>・{declaration.type}
                  {declaration.required ? "・必須" : ""})
                </Span>
              ))}
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
