// src/features/core/messaging/components/AdminMessageOverrideEditor/index.tsx
// セクションコンテナ(管理: 1 連絡の文言の上書き)。使える {{鍵}} の案内 + 欄ごとの編集(保存・既定に戻すは欄 1 つずつ)。
// 書く欄の状態・保存・離れる前の確認は hook useMessageOverrideEditor。下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { err } from "@/lib/errors";

import { AllowedKeysHint } from "@/features/core/messaging/components/common/AllowedKeysHint";
import { OverrideFieldEditor } from "@/features/core/messaging/components/common/OverrideFieldEditor";
import { useMessageOverrideEditor } from "@/features/core/messaging/hooks/useMessageOverrideEditor";

export type AdminMessageOverrideEditorProps = {
  /** 連絡の鍵(例: "user.registrationComplete") */
  messageKey: string;
};

export function AdminMessageOverrideEditor({ messageKey }: AdminMessageOverrideEditorProps) {
  const editor = useMessageOverrideEditor(messageKey);
  const { detail } = editor;

  if (editor.isLoading && !detail) {
    return (
      <Flex justify="center" className="py-8">
        <Spinner className="size-6" />
      </Flex>
    );
  }
  if (!detail) {
    return (
      <Para tone="muted" align="center">
        {editor.error ? err(editor.error, "文言を取得できませんでした") : "この連絡は直せません"}
      </Para>
    );
  }

  return (
    <Stack space={5}>
      <Stack space={2} className="rounded-md border border-border bg-muted/30 p-4">
        <Flex gap="sm" wrap="wrap">
          <Span size="sm" className="font-mono">
            {detail.key}
          </Span>
          <Span size="sm" tone="muted">
            {detail.kind} / {detail.category}
          </Span>
        </Flex>
        <Para size="sm" tone="muted" className="my-0">
          直した欄だけ管理画面の値で送ります。デザインとリンクはコードのままです。
        </Para>
        <AllowedKeysHint allowedKeys={editor.allowedKeys} />
      </Stack>

      {detail.fields.map((field) => (
        <OverrideFieldEditor
          key={field.path}
          field={field}
          value={editor.valueOf(field)}
          onChange={(value) => editor.setDraft(field, value)}
          dirty={editor.isDirty(field)}
          unknownKeys={editor.unknownKeys(field)}
          onSave={() => editor.save(field)}
          onReset={() => editor.reset(field)}
          onDiscard={() => editor.discard(field)}
        />
      ))}
    </Stack>
  );
}
