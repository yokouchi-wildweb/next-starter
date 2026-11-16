// src/features/core/messaging/components/AdminMessageOverrideModal/index.tsx
// セクションコンテナ(管理: 1 連絡の文言の上書きを直すモーダル。D87)。開閉は置き場が持つ(open・onOpenChange・messageKey)。
// 中身 = 連絡の名前・種類 / カテゴリーの表示名(連絡の鍵は見せない、D46)・使える {{鍵}} の案内 + 2 つの欄(D80、部品 MessageEditorLayout):
// 左 = 今の経路のプレビュー(ChannelPreview。メールは描いた HTML、入力中の欄を枠で示す)、右 = 経路のタブと欄ごとの編集
// (保存・既定に戻すは欄 1 つずつ。部品 OverrideFieldEditor、入力は欄の表示の約束から)。
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
import { ChannelPreview } from "@/features/core/messaging/components/common/ChannelPreview";
import { MessageEditorLayout } from "@/features/core/messaging/components/common/MessageEditorLayout";
import { OverrideFieldEditor } from "@/features/core/messaging/components/common/OverrideFieldEditor";
import { useMessageOverrideEditor } from "@/features/core/messaging/hooks/useMessageOverrideEditor";
import { useCopyMessageVariable } from "@/features/core/messaging/hooks/useCopyMessageVariable";
import { useModalSession } from "@/hooks/useModalSession";

export type AdminMessageOverrideModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 連絡の鍵(例: "user.registrationComplete")。null の間は何も描かない */
  messageKey: string | null;
};

const MODAL_WIDTH = "1200px";

export function AdminMessageOverrideModal({ open, onOpenChange, messageKey }: AdminMessageOverrideModalProps) {
  const session = useModalSession(open);
  if (!messageKey) return null;
  return <OverrideModalBody key={`${session}:${messageKey}`} open={open} onOpenChange={onOpenChange} messageKey={messageKey} />;
}

function OverrideModalBody({ open, onOpenChange, messageKey }: { open: boolean; onOpenChange: (open: boolean) => void; messageKey: string }) {
  const editor = useMessageOverrideEditor(messageKey);
  const copyKey = useCopyMessageVariable();
  const { detail } = editor;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={detail ? `文言を編集: ${detail.label}` : "文言を編集"}
      maxWidth={MODAL_WIDTH}
      confirmOnClose={editor.closeConfirm}
    >
      {editor.isLoading && !detail ? (
        <Flex justify="center" className="py-8">
          <Spinner className="size-6" />
        </Flex>
      ) : !detail ? (
        <Para tone="muted" align="center">
          {editor.error ? err(editor.error, "文言を取得できませんでした") : "この通知の文言は編集できません"}
        </Para>
      ) : (
        <Stack space={5}>
          <Stack space={2} className="rounded-md border border-border bg-muted/30 p-4">
            <Flex gap="sm" wrap="wrap">
              <Span size="sm" weight="semiBold">
                {detail.label}
              </Span>
              <Span size="sm" tone="muted">
                種類: {dispatchKindLabel(detail.kind) ?? "-"} / カテゴリー: {detail.categoryLabel ?? "-"}
              </Span>
            </Flex>
            <Para size="sm" tone="muted" className="my-0">
              編集した項目だけ、ここで設定した文言で送信します。デザインとリンクは変わりません。
            </Para>
            <AllowedKeysHint allowedKeys={editor.allowedKeys} onCopyKey={copyKey} />
          </Stack>

          {editor.channels.length > 0 ? (
            <MessageEditorLayout
              channels={editor.channels}
              activeChannel={editor.activeChannel}
              onChannelChange={editor.setActiveChannel}
              preview={
                editor.activeChannelInfo ? (
                  <ChannelPreview
                    channel={editor.activeChannelInfo}
                    values={editor.activeValues}
                    fieldMeta={editor.activeFieldMeta}
                    focusedPath={editor.focusedPath}
                    html={editor.previewHtml}
                    loading={editor.previewLoading}
                  />
                ) : null
              }
            >
              <Stack space={3}>
                {editor.activeFields.map((field) => (
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
                    onFocusField={editor.setFocusedPath}
                  />
                ))}
              </Stack>
            </MessageEditorLayout>
          ) : null}
        </Stack>
      )}
    </Modal>
  );
}
