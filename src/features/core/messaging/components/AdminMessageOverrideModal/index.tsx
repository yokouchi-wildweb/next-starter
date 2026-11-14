// src/features/core/messaging/components/AdminMessageOverrideModal/index.tsx
// セクションコンテナ(管理: 1 連絡の文言の上書きを直すモーダル。D87)。開閉は置き場が持つ(open・onOpenChange・messageKey)。
// 中身 = 連絡の名前・種別 / カテゴリーの表示名(連絡の鍵は見せない、D46)・使える {{鍵}} の案内 + 欄ごとの編集(保存・既定に戻すは欄 1 つずつ。部品 OverrideFieldEditor)。
// 流れは hook useMessageOverrideEditor。部品は公開の部品だけなので、fork は自分の画面にも同じモーダルを置ける。
// 保存していない欄があるまま閉じる = confirmOnClose、ページの移動 = hook の中の @/lib/unsavedGuard。開き直すたびに下書きを捨てる

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { err } from "@/lib/errors";

import { AllowedKeysHint } from "@/features/core/messaging/components/common/AllowedKeysHint";
import { dispatchKindLabel } from "@/features/core/messaging/components/common/DispatchRow";
import { OverrideFieldEditor } from "@/features/core/messaging/components/common/OverrideFieldEditor";
import { useMessageOverrideEditor } from "@/features/core/messaging/hooks/useMessageOverrideEditor";
import { useModalSession } from "@/features/core/messaging/hooks/useModalSession";

export type AdminMessageOverrideModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 連絡の鍵(例: "user.registrationComplete")。null の間は何も描かない */
  messageKey: string | null;
};

const MODAL_WIDTH = "800px";

export function AdminMessageOverrideModal({ open, onOpenChange, messageKey }: AdminMessageOverrideModalProps) {
  const session = useModalSession(open);
  if (!messageKey) return null;
  return <OverrideModalBody key={`${session}:${messageKey}`} open={open} onOpenChange={onOpenChange} messageKey={messageKey} />;
}

function OverrideModalBody({ open, onOpenChange, messageKey }: { open: boolean; onOpenChange: (open: boolean) => void; messageKey: string }) {
  const editor = useMessageOverrideEditor(messageKey);
  const { detail } = editor;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={detail ? `文言を直す: ${detail.label}` : "文言を直す"}
      maxWidth={MODAL_WIDTH}
      confirmOnClose={editor.closeConfirm}
    >
      {editor.isLoading && !detail ? (
        <Flex justify="center" className="py-8">
          <Spinner className="size-6" />
        </Flex>
      ) : !detail ? (
        <Para tone="muted" align="center">
          {editor.error ? err(editor.error, "文言を取得できませんでした") : "この連絡は直せません"}
        </Para>
      ) : (
        <Stack space={5}>
          <Stack space={2} className="rounded-md border border-border bg-muted/30 p-4">
            <Flex gap="sm" wrap="wrap">
              <Span size="sm" weight="semiBold">
                {detail.label}
              </Span>
              <Span size="sm" tone="muted">
                {dispatchKindLabel(detail.kind) ?? "-"} / {detail.categoryLabel ?? "-"}
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
      )}
    </Modal>
  );
}
