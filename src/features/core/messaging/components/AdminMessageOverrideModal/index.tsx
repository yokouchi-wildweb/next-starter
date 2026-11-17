// src/features/core/messaging/components/AdminMessageOverrideModal/index.tsx
// セクションコンテナ(管理: 1 連絡の文言の上書きを直すモーダル。D87)。開閉は置き場が持つ(open・onOpenChange・messageKey)。
// 中身 = 連絡の名前・種類 / カテゴリーの表示名(連絡の鍵は見せない、D46)・直せる欄の案内(既定でひな形の全欄、連絡が絞ればその欄だけ、D132)・
// 使えない行の数・埋め込み情報のタグ(EmbeddedInfoTags)+ 2 つの欄(D80、部品 MessageEditorLayout):
// 左 = 今の経路のプレビュー(上書きと下書きを重ねたひな形の描き方。部品 LayoutPreview: 経路のタブは右と同じ値、メールは描いた HTML で
// 入力中の欄を枠で示す、お知らせはひな形のお知らせの描き方)、右 = 経路のタブと欄ごとの編集
// (保存・元の文言に戻すは欄 1 つずつ。部品 OverrideFieldEditor、入力はひな形の欄の型から LayoutFieldInput)。
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

import { dispatchKindLabel } from "@/features/core/messaging/components/common/DispatchRow";
import { EmbeddedInfoPopover } from "@/features/core/messaging/components/common/EmbeddedInfoPopover";
import { LayoutPreview } from "@/features/core/messaging/components/common/LayoutPreview";
import { MessageEditorLayout } from "@/features/core/messaging/components/common/MessageEditorLayout";
import { OverrideFieldEditor } from "@/features/core/messaging/components/common/OverrideFieldEditor";
import { useMessageOverrideEditor } from "@/features/core/messaging/hooks/useMessageOverrideEditor";
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
              編集した項目だけ、ここで設定した文言で送信します。編集できる項目は通知のひな形の項目すべてです(通知が絞っている時はその項目だけ)。
            </Para>
            {editor.unusableCount > 0 ? (
              <Para size="sm" tone="destructive" className="my-0">
                使えない編集が {editor.unusableCount} 件あります(元の文言で送信しています)。内容を確認して元の文言に戻すか、編集し直してください。
              </Para>
            ) : null}
            <Flex>
              <EmbeddedInfoPopover side="bottom" common={editor.embeddedTags.common} own={editor.embeddedTags.own} onCopy={editor.embeddedTags.copy} />
            </Flex>
          </Stack>

          {editor.channels.length > 0 ? (
            <MessageEditorLayout
              channels={editor.channels}
              activeChannel={editor.activeChannel}
              onChannelChange={editor.setActiveChannel}
              preview={
                <Stack space={2} data-slot="override-preview">
                  {editor.previewLoading && !editor.previewContent ? (
                    <Flex justify="center" className="py-8">
                      <Spinner className="size-6" />
                    </Flex>
                  ) : editor.previewLayout ? (
                    <LayoutPreview
                      layout={editor.previewLayout}
                      channels={editor.channels.map((channel) => channel.key)}
                      channel={editor.activeChannel}
                      onChannelChange={editor.setActiveChannel}
                      content={editor.previewContent}
                      loading={editor.previewLoading}
                      emailHeight={520}
                    />
                  ) : (
                    <Para size="sm" tone="muted" className="my-0">
                      プレビューを表示できませんでした
                    </Para>
                  )}
                  <Para size="xs" tone="muted" className="my-0">
                    {"{{名前}}"} は送信時に実際の値に置き換わります
                  </Para>
                </Stack>
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
                    commonToAll={editor.channels.every((channel) => field.channels.includes(channel.key))}
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
