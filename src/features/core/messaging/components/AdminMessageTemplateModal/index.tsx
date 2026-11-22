// src/features/core/messaging/components/AdminMessageTemplateModal/index.tsx
// セクションコンテナ(管理: テンプレートを作る・直すモーダル。D87)。開閉は置き場が持つ(open・onOpenChange・templateId)。
// タブは無い: バージョン履歴は直す時だけボタンから重ねたモーダル。変数のタブも無い(専用の埋め込み情報はボタンのモーダル、D111)。
// 内容 = 左右 2 つのペイン(D114): 左 = 一番上でレイアウトを選び、その下に実際の描き方のプレビュー(送信チャンネルのタブ、未入力は仮の文)。
//   右 = 名前・説明・種別とカテゴリーの 1 行(KindCategoryFields、D118)→ レイアウトの欄の入力(プレビューのタブの送信チャンネルで使う欄だけ、D117)・埋め込み情報のタグと『専用の埋め込み情報を管理』(D115)。
//   狭い画面は操作が上、プレビューがその下
// レイアウトを替えると、中身があれば確かめてから消す(D113)。保存 = 新しいバージョン(D113)。
// システムテンプレート(白紙)は読むだけ(D117)。削除は確かめてから(送信は残る、D137)、消せたらモーダルを閉じる(一覧は行を外す)。
// 中身の入力と埋め込み情報は、レイアウト・種別・カテゴリーがそろいカテゴリーに送信チャンネルがある時だけ(D139。それまでは先に選ぶ物の 1 行)。
// 操作の後は onChanged(返った 1 件と操作)を呼ぶ: 一覧が行を足す・置き換える。作った後は同じモーダルでその 1 件を直す形に変わる。
// 流れは hook useMessageTemplateModal(取る物・タブ・作った後)・useMessageTemplateForm(書く欄・操作)・useLayoutPreview(プレビュー)・
// useVarTags(タグ)。部品は公開の部品だけなので、fork は自分の画面にも同じモーダルを置ける。
// 書きかけのまま閉じる = confirmOnClose、ページの移動 = hook の中の @/lib/unsavedGuard

"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { SelectInput } from "@/components/Input/Select";
import { Textarea } from "@/components/Input/Textarea";
import { Label } from "@/components/Input/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import Dialog from "@/components/Overlays/Dialog";
import { InlineLoader } from "@/components/Overlays/Loading";
import Modal from "@/components/Overlays/Modal";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { err } from "@/lib/errors";

import { VarPopover } from "@/features/core/messaging/components/common/VarPopover";
import { KindCategoryFields } from "@/features/core/messaging/components/common/KindCategoryFields";
import { LayoutFields } from "@/features/core/messaging/components/common/LayoutFields";
import { LayoutPreview } from "@/features/core/messaging/components/common/LayoutPreview";
import { TemplateVarsModal } from "@/features/core/messaging/components/common/TemplateVarsModal";
import { TemplateVersionList } from "@/features/core/messaging/components/common/TemplateVersionList";
import { useVarTags } from "@/features/core/messaging/hooks/useVarTags";
import { useLayoutPreview } from "@/features/core/messaging/hooks/useLayoutPreview";
import { useMessageTemplateForm, type MessageTemplateAction } from "@/features/core/messaging/hooks/useMessageTemplateForm";
import { useMessageTemplateModal } from "@/features/core/messaging/hooks/useMessageTemplateModal";
import type { AdminTemplateDetail } from "@/features/core/messaging/services/client/templateClient";

export type AdminMessageTemplateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 直す 1 件の id(null・省略 = 作る) */
  templateId?: string | null;
  /** 作る・保存・削除の後(返った 1 件と操作。一覧の取り直し・行の置き換えに使う) */
  onChanged?: (template: AdminTemplateDetail, action: MessageTemplateAction) => void;
};

const MODAL_WIDTH = "1200px";

export function AdminMessageTemplateModal({ open, onOpenChange, templateId = null, onChanged }: AdminMessageTemplateModalProps) {
  const m = useMessageTemplateModal({ open, templateId, onChanged });

  if (m.state !== "ready" || !m.options) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={templateId || m.mode === "edit" ? "テンプレートを編集" : "テンプレートを作成"} maxWidth={MODAL_WIDTH}>
        {m.state === "loading" ? (
          <InlineLoader />
        ) : (
          <Para tone="destructive" align="center">
            {err(m.error, "テンプレートを取得できませんでした")}
          </Para>
        )}
      </Modal>
    );
  }

  // 書く欄は開いた回・1 件の版ごとに作り直す(保存の後はサーバーの値になる)
  return <TemplateModalBody key={m.formKey} modal={m} options={m.options} open={open} onOpenChange={onOpenChange} />;
}

type ModalState = ReturnType<typeof useMessageTemplateModal>;

function TemplateModalBody({
  modal,
  options,
  open,
  onOpenChange,
}: {
  modal: ModalState;
  options: NonNullable<ModalState["options"]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { template, versions } = modal;
  const form = useMessageTemplateForm({ template, options, onCreated: modal.onCreated, onChanged: modal.onChanged });
  const { fields, varsEditor } = form;
  const preview = useLayoutPreview({
    layout: fields.layout || null,
    fields: form.layoutFields,
    values: form.values,
    channels: fields.channels,
    category: fields.category || null,
    enabled: open,
    // 空の欄は見出しの仮の枠で見せる(D127)
    mode: "template",
  });
  const tags = useVarTags({ catalog: form.catalog });
  const locked = form.readOnly;
  const [versionsOpen, setVersionsOpen] = useState(false);

  // 埋め込み情報 = 下の操作の帯の左(モーダルに固定でいつも押せる)。吹き出しは上に開く(VarPopover)
  const varControls = (
    <VarPopover
      common={tags.common}
      own={tags.own}
      onCopy={tags.copy}
      unknownNames={form.unknownNames}
      onManage={locked ? undefined : varsEditor.openEditor}
      manageCount={varsEditor.count}
    />
  );

  const footer = (
    <Flex align="center" justify="between" gap="md" wrap="wrap">
      {/* 埋め込み情報は入力欄と同じく、そろうまで出さない(D139)。右の操作は右に寄せたまま */}
      {form.fieldsReady ? varControls : null}
      {locked ? null : (
        <Flex justify="end" gap="xs" wrap="wrap" className="ml-auto">
          {template ? (
            <ConfirmPopover
              trigger={
                <Button type="button" size="sm" variant="outline" disabled={form.dirty}>
                  削除
                </Button>
              }
              title="削除"
              description="テンプレートを削除します。送信の記録は残ります(どのテンプレートから送ったかは表示されなくなります)"
              confirmLabel="削除する"
              confirmVariant="destructive"
              onConfirm={async () => {
                if (await form.remove()) onOpenChange(false);
              }}
            />
          ) : null}
          <ConfirmPopover
            trigger={
              <Button type="button" size="sm" variant="primary" disabled={!form.dirty}>
                保存
              </Button>
            }
            title="保存"
            description="現在の内容をこのテンプレートの新しいバージョンとして保存します。保存したバージョンは変更できません。"
            confirmLabel="保存する"
            onConfirm={form.save}
          />
        </Flex>
      )}
    </Flex>
  );

  const textTab = (
    <Flex direction="column" gap="xl" className="md:flex-row-reverse md:items-start" data-slot="template-editor">
      <Stack gap="md" className="min-w-0 md:w-1/2" data-slot="template-editor-controls">
        {template ? (
          <Flex align="center" justify="between" gap="xs" wrap="wrap" data-slot="template-status-row">
            <Flex align="center" gap="xs" wrap="wrap">
              <SoftBadge variant="success" size="md">
                {template.currentVersion ? `v${template.currentVersion}` : "バージョンなし"}
              </SoftBadge>
            </Flex>
            {/* 版の履歴はタブにせず、状態の札の横のボタンから重ねたモーダルで見る(作る時は版が無いので出さない) */}
            <Button type="button" size="sm" variant="ghost" onClick={() => setVersionsOpen(true)} data-slot="template-versions-open">
              <History className="size-4" />
              バージョン履歴
            </Button>
          </Flex>
        ) : null}

        <Stack gap="sm" className="rounded-md border border-border bg-card p-4" data-slot="template-meta">
          <Stack gap="2xs">
            <Label htmlFor="template-name" className="text-sm">
              テンプレート名
            </Label>
            <Input id="template-name" value={fields.name} disabled={locked} onChange={(e) => fields.setName(e.target.value)} />
          </Stack>
          <KindCategoryFields
            idPrefix="template"
            kinds={fields.kindOptions}
            kind={fields.kind}
            onKindChange={fields.setKind}
            categories={fields.categoryChoices}
            category={fields.category}
            onCategoryChange={fields.setCategory}
            disabled={locked}
          />
          <Stack gap="2xs">
            <Label htmlFor="template-description" className="text-sm">
              説明(任意)
            </Label>
            <Textarea id="template-description" value={fields.description} rows={2} disabled={locked} onChange={(e) => fields.setDescription(e.target.value)} />
          </Stack>
        </Stack>

        <Stack gap="xs" className="rounded-md border border-border bg-card p-4" data-slot="template-values">
          {form.layoutFields && form.fieldsReady ? (
            <LayoutFields
              control={form.valuesForm.control}
              fields={form.layoutFields}
              channels={fields.channels}
              activeChannel={preview.channel}
              readOnly={locked}
            />
          ) : (
            <Span size="sm" tone="muted">
              {form.fieldsHint ?? "レイアウトを選ぶと入力欄が出ます"}
            </Span>
          )}
        </Stack>
      </Stack>

      <Stack gap="sm" className="min-w-0 md:sticky md:top-0 md:w-1/2" data-slot="template-editor-preview">
        <Stack gap="2xs">
          <Label htmlFor="template-layout" className="text-sm">
            レイアウト
          </Label>
          <SelectInput
            id="template-layout"
            value={fields.layout}
            disabled={locked}
            options={fields.layoutOptions.map((item) => ({ value: item.value, label: item.label }))}
            placeholder="レイアウトを選択"
            onChange={(v) => fields.requestLayoutChange(v ? String(v) : "")}
          />
          {fields.layoutOptions.find((item) => item.value === fields.layout)?.description ? (
            <Span size="xs" tone="muted">
              {fields.layoutOptions.find((item) => item.value === fields.layout)?.description}
            </Span>
          ) : null}
        </Stack>
        <Span size="sm" weight="semiBold">
          プレビュー
        </Span>
        <LayoutPreview
          layout={preview.layout}
          channels={preview.channels}
          channel={preview.channel}
          onChannelChange={preview.setChannel}
          content={preview.content}
          loading={preview.loading}
          error={preview.error}
          incompleteChannels={preview.incompleteChannels}
        />
      </Stack>
    </Flex>
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={template ? `テンプレートを編集: ${template.name}` : "テンプレートを作成"}
        maxWidth={MODAL_WIDTH}
        // 高さは固定(送る・テキストの編集のモーダルと同じ 85vh)
        maxHeight="85vh"
        height="85vh"
        footer={footer}
        confirmOnClose={form.closeConfirm}
      >
        {textTab}
      </Modal>
      {template ? (
        <Modal open={versionsOpen} onOpenChange={setVersionsOpen} title={`バージョン履歴: ${template.name}`} maxWidth="760px">
          <TemplateVersionList versions={versions} currentVersion={template.currentVersion} layouts={options.layouts} />
        </Modal>
      ) : null}
      <Dialog
        open={fields.pendingLayout !== null}
        onOpenChange={(next) => {
          if (!next) fields.cancelLayoutChange();
        }}
        title="レイアウトを変更"
        description="レイアウトを変えると、入力中の内容はすべて消えます。よろしいですか？"
        showCancelButton
        showConfirmButton
        confirmLabel="変更する"
        confirmVariant="destructive"
        onConfirm={fields.confirmLayoutChange}
      />
      <TemplateVarsModal
        open={varsEditor.open}
        onOpenChange={varsEditor.setOpen}
        rows={varsEditor.rows}
        onUpdateRow={varsEditor.updateRow}
        onAddRow={varsEditor.addRow}
        onRemoveRow={varsEditor.removeRow}
        onApply={() => {
          varsEditor.apply();
        }}
        errors={varsEditor.errors}
        readOnly={locked}
      />
    </>
  );
}
