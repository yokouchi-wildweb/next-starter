// src/features/core/messaging/components/common/TemplateVersionList/index.tsx
// 部品(props だけ): 公開した版の一覧(新しい順)と、選んだ 1 版の中身(読むだけ。版は書き換えない)。
// 中身は MessagePreview で欄から描く(前の版の HTML は描かない: プレビューの API は今の公開版だけを描く)

"use client";

import { useState } from "react";

import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

import type { AdminTemplateVersion } from "@/features/core/messaging/services/client/templateClient";

import { MessagePreview } from "../MessagePreview";

export type TemplateVersionListProps = {
  versions: AdminTemplateVersion[];
  /** 今の公開の版(印を付ける) */
  currentVersion?: number | null;
};

const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
};

export function TemplateVersionList({ versions, currentVersion }: TemplateVersionListProps) {
  const [opened, setOpened] = useState<number | null>(null);
  if (versions.length === 0) {
    return (
      <Para size="sm" tone="muted" className="my-0">
        まだ公開した版はありません
      </Para>
    );
  }
  const shown = versions.find((version) => version.version === opened) ?? null;
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
              {version.category} / {version.channels.join(" / ")}
            </Span>
          </Flex>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpened(opened === version.version ? null : version.version)}
          >
            {opened === version.version ? "閉じる" : "中身を見る"}
          </Button>
        </Flex>
      ))}
      {shown ? (
        <Stack space={3} className="rounded bg-muted/40 p-3">
          <Span size="sm" tone="muted">
            v{shown.version} の中身
          </Span>
          <MessagePreview
            channels={shown.channels.map((key) => ({ key, fields: shown.content[key] ?? {} }))}
          />
          {shown.variables.length > 0 ? (
            <Stack space={1}>
              <Span size="sm" tone="muted">
                変数
              </Span>
              {shown.variables.map((variable) => (
                <Span key={variable.key} size="sm">
                  <Span size="inherit" className="font-mono">{`{{${variable.key}}}`}</Span> {variable.label}({variable.type}
                  {variable.required ? "・必須" : ""})
                </Span>
              ))}
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
