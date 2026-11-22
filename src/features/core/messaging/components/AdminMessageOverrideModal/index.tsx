// src/features/core/messaging/components/AdminMessageOverrideModal/index.tsx
// セクションコンテナ(管理: 1 連絡のテキストの編集のモーダル。D87)。開閉は置き場が持つ(open・onOpenChange・messageKey)。
// 中身 = 連絡の名前・種類 / カテゴリーの表示名(連絡の鍵は見せない、D46)・直せる欄の案内(既定でレイアウトの全欄、連絡が絞ればその欄だけ、D132)・
// 使えない行の数 + 2 つのペイン(テンプレート・送るモーダルと同じ形):
// 左 = 今の送信チャンネルのプレビュー(保存したテキストの編集と下書きを重ねたレイアウトの描き方。部品 LayoutPreview: 送信チャンネルのタブはここだけ、メールは描いた HTML で
// 入力中の欄を枠で示す、お知らせはレイアウトのお知らせの描き方)、右 = 名前・種別とカテゴリー(読むだけ)・欄ごとの編集。
// 埋め込み情報は下の帯の左の吹き出し(VarPopover)。高さは固定。
// 変数の名前は別名で見せる(D133: 入力・元の文言・使えない名前・プレビューの {{鍵}} → {{別名}}、hook が変える)。
// 下の帯の左に「すべてデフォルトに戻す」(D136: 確かめて、保存してある欄の全部に戻す印・下書きを捨てる。保存で当たる)
// 保存は 1 回(D132、テンプレートのモーダルと同じ): 下の帯の右の「保存」が直した欄の全部をまとめて保存する(確かめ・保存の間 loading、
// 1 つの取引、通らない欄は欄に理由)。欄ごとの操作は「元の文言に戻す」だけ(保存で当たる。部品 OverrideFieldEditor、入力はレイアウトの欄の型から LayoutFieldInput)。
// 流れは hook useMessageOverrideEditor。部品は公開の部品だけなので、fork は自分の画面にも同じモーダルを置ける。
// 保存していない欄があるまま閉じる = confirmOnClose、ページの移動 = hook の中の @/lib/unsavedGuard。開き直すたびに下書きを捨てる

"use client";

import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { InlineLoader } from "@/components/Overlays/Loading";
import Modal from "@/components/Overlays/Modal";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { err } from "@/lib/errors";

import { dispatchKindLabel } from "@/features/core/messaging/components/common/DispatchRow";
import { VarPopover } from "@/features/core/messaging/components/common/VarPopover";
import { LayoutPreview } from "@/features/core/messaging/components/common/LayoutPreview";
import { KindCategoryFields } from "@/features/core/messaging/components/common/KindCategoryFields";
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
      // 高さは固定(送るモーダルと同じ)。下の帯の左 = 埋め込み情報の吹き出し(上に開く)
      maxHeight="85vh"
      height="85vh"
      footer={
        detail ? (
          <Flex align="center" justify="between" gap="md" wrap="wrap">
            <Flex align="center" gap="md" wrap="wrap" className="min-w-0">
              <VarPopover common={editor.varTags.common} own={editor.varTags.own} onCopy={editor.varTags.copy} />
              <ConfirmPopover
                trigger={
                  <Button type="button" size="sm" variant="outline" disabled={!editor.canResetAll || editor.isSaving} data-slot="override-reset-all">
                    すべてデフォルトに戻す
                  </Button>
                }
                title="すべてデフォルトに戻す"
                description="編集したすべての項目を元の文言に戻す印を付け、未保存の編集を破棄します。「保存」で確定します。"
                confirmLabel="戻す"
                onConfirm={editor.resetAll}
              />
            </Flex>
            <Flex align="center" gap="md">
              {editor.hasDrafts ? (
                <Span size="sm" tone="muted" data-slot="override-pending-count">
                  未保存の項目 {editor.pendingCount} 件
                </Span>
              ) : null}
              <ConfirmPopover
                trigger={
                  <Button type="button" size="sm" variant="primary" disabled={!editor.hasDrafts} loading={editor.isSaving}>
                    保存
                  </Button>
                }
                title="保存"
                description="編集した項目をまとめて保存します。次に送信する通知から、この文言で送信します(元の文言に戻す項目は元の文言になります)。"
                confirmLabel="保存する"
                onConfirm={editor.saveAll}
              />
            </Flex>
          </Flex>
        ) : null
      }
      confirmOnClose={editor.closeConfirm}
    >
      {editor.isLoading && !detail ? (
        <InlineLoader />
      ) : !detail ? (
        <Para tone="muted" align="center">
          {editor.error ? err(editor.error, "文言を取得できませんでした") : "この通知の文言は編集できません"}
        </Para>
      ) : (
        // 左右 2 つのペイン(テンプレート・送るモーダルと同じ形): 左 = プレビュー(送信チャンネルのタブはここだけ、md 以上は上に留まる)、
        // 右 = 通知の名前・種別とカテゴリー(読むだけ)→ 注意 → 欄ごとの編集。狭い画面は右が上
        <Flex direction="column" gap="xl" className="md:flex-row-reverse md:items-start" data-slot="override-editor">
          <Stack gap="md" className="min-w-0 md:w-1/2" data-slot="override-editor-controls">
            <Stack gap="sm" className="rounded-md border border-border bg-card p-4" data-slot="override-meta">
              <Stack gap="2xs">
                <Span size="sm" weight="medium" tone="muted">
                  通知
                </Span>
                <Span weight="semiBold">{detail.label}</Span>
              </Stack>
              <KindCategoryFields
                idPrefix="override"
                kinds={[{ value: detail.kind ?? "-", label: dispatchKindLabel(detail.kind) ?? "-" }]}
                kind={detail.kind ?? "-"}
                onKindChange={() => {}}
                categories={[{ value: "current", label: detail.categoryLabel ?? "-" }]}
                category="current"
                onCategoryChange={() => {}}
                disabled
              />
            </Stack>
            <Stack gap="2xs">
              <Para size="sm" tone="muted" className="my-0">
                編集した項目だけ、ここで設定した文言で送信します。編集は下の「保存」でまとめて保存します。編集できる項目は通知のレイアウトの項目すべてです(通知が絞っている時はその項目だけ)。
              </Para>
              {editor.unusableCount > 0 ? (
                <Para size="sm" tone="destructive" className="my-0">
                  使えない編集が {editor.unusableCount} 件あります(元の文言で送信しています)。内容を確認して元の文言に戻すか、編集し直してください。
                </Para>
              ) : null}
            </Stack>
            {editor.channels.length > 0 ? (
              <Stack gap="sm" data-slot="override-fields">
                {editor.activeFields.map((field) => (
                  <OverrideFieldEditor
                    key={field.path}
                    // 宣言の無い行が文字で見せる保存した値も別名で
                    field={{ ...field, value: editor.varTags.toAliases(field.value) }}
                    value={editor.valueOf(field)}
                    onChange={(value) => editor.setDraft(field, value)}
                    dirty={editor.isDirty(field)}
                    unknownKeys={editor.unknownKeys(field)}
                    onReset={() => editor.reset(field)}
                    resetPending={editor.isResetPending(field)}
                    error={editor.fieldErrors[field.path] ?? null}
                    onFocusField={editor.setFocusedPath}
                    commonToAll={editor.channels.every((channel) => field.channels.includes(channel.key))}
                    codeValue={editor.codeValueOf(field)}
                  />
                ))}
              </Stack>
            ) : null}
          </Stack>

          <Stack gap="sm" className="min-w-0 md:sticky md:top-0 md:w-1/2" data-slot="override-preview">
            <Span size="sm" weight="semiBold">
              プレビュー
            </Span>
            {editor.previewLoading && !editor.previewContent ? (
              <InlineLoader />
            ) : editor.previewLayout && editor.channels.length > 0 ? (
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
        </Flex>
      )}
    </Modal>
  );
}
