// src/features/core/messaging/components/AdminMessageTemplateModal/index.tsx
// セクションコンテナ(管理: テンプレートを作る・直すモーダル。D87)。開閉は置き場が持つ(open・onOpenChange・templateId)。
// タブ: 内容 / バージョン履歴(直す時だけ)。変数のタブは無い(専用の埋め込み情報はボタンのモーダル、D111)。
// 内容 = 左右 2 つのペイン(D114): 左 = 一番上でひな形を選び、その下に実際の描き方のプレビュー(経路のタブ、未入力は仮の文)。
//   右 = 名前・説明・種別とカテゴリーの 1 行(KindCategoryFields、D118)→ ひな形の欄の入力(プレビューのタブの経路で使う欄だけ、D117)・埋め込み情報のタグと『専用の埋め込み情報を管理』(D115)。
//   狭い画面は操作が上、プレビューがその下
// ひな形を替えると、中身があれば確かめてから消す(D113)。保存 = 新しいバージョン(D113)。
// システムテンプレート(白紙)とアーカイブした物は読むだけ(D117)。
// 操作の後は onChanged(返った 1 件と操作)を呼ぶ: 一覧が行を足す・置き換える。作った後は同じモーダルでその 1 件を直す形に変わる。
// 流れは hook useMessageTemplateModal(取る物・タブ・作った後)・useMessageTemplateForm(書く欄・操作)・useLayoutPreview(プレビュー)・
// useEmbeddedInfoTags(タグ)。部品は公開の部品だけなので、fork は自分の画面にも同じモーダルを置ける。
// 書きかけのまま閉じる = confirmOnClose、ページの移動 = hook の中の @/lib/unsavedGuard

"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button";
import { Input, SelectInput, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import Dialog from "@/components/Overlays/Dialog";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import Modal from "@/components/Overlays/Modal";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { err } from "@/lib/errors";

import { EmbeddedInfoPopover } from "@/features/core/messaging/components/common/EmbeddedInfoPopover";
import { KindCategoryFields } from "@/features/core/messaging/components/common/KindCategoryFields";
import { LayoutFields } from "@/features/core/messaging/components/common/LayoutFields";
import { LayoutPreview } from "@/features/core/messaging/components/common/LayoutPreview";
import { TemplateEmbeddedInfoModal } from "@/features/core/messaging/components/common/TemplateEmbeddedInfoModal";
import { TemplateStatusBadge } from "@/features/core/messaging/components/common/TemplateStatusBadge";
import { TemplateVersionList } from "@/features/core/messaging/components/common/TemplateVersionList";
import { useEmbeddedInfoTags } from "@/features/core/messaging/hooks/useEmbeddedInfoTags";
import { useLayoutPreview } from "@/features/core/messaging/hooks/useLayoutPreview";
import { useMessageTemplateForm, type MessageTemplateAction } from "@/features/core/messaging/hooks/useMessageTemplateForm";
import { useMessageTemplateModal } from "@/features/core/messaging/hooks/useMessageTemplateModal";
import type { AdminTemplateDetail } from "@/features/core/messaging/services/client/templateClient";

export type AdminMessageTemplateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 直す 1 件の id(null・省略 = 作る) */
  templateId?: string | null;
  /** 作る・保存・取り下げの後(返った 1 件と操作。一覧の取り直し・行の置き換えに使う) */
  onChanged?: (template: AdminTemplateDetail, action: MessageTemplateAction) => void;
};

/** システムテンプレートのカテゴリーの表示だけの値(選択肢 1 つ「送信時に選ぶ」) */
const SYSTEM_CATEGORY_NOTE = "__system-category__";

const MODAL_WIDTH = "1200px";

export function AdminMessageTemplateModal({ open, onOpenChange, templateId = null, onChanged }: AdminMessageTemplateModalProps) {
  const m = useMessageTemplateModal({ open, templateId, onChanged });

  if (m.state !== "ready" || !m.options) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={templateId || m.mode === "edit" ? "テンプレートを編集" : "テンプレートを作成"} maxWidth={MODAL_WIDTH}>
        {m.state === "loading" ? (
          <Flex justify="center" className="py-8">
            <Spinner className="size-6" />
          </Flex>
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
  const { fields, embeddedEditor } = form;
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
  const tags = useEmbeddedInfoTags({ catalog: form.catalog });
  const locked = form.readOnly;
  const [versionsOpen, setVersionsOpen] = useState(false);

  // 埋め込み情報 = 下の操作の帯の左(モーダルに固定でいつも押せる)。吹き出しは上に開く(EmbeddedInfoPopover)
  const embeddedControls = (
    <EmbeddedInfoPopover
      common={tags.common}
      own={tags.own}
      onCopy={tags.copy}
      unknownNames={form.unknownNames}
      onManage={locked ? undefined : embeddedEditor.openEditor}
      manageCount={embeddedEditor.count}
    />
  );

  const footer = form.system ? null : (
    <Flex align="center" justify="between" gap="sm" wrap="wrap">
      {embeddedControls}
      {locked ? null : (
        <Flex justify="end" gap="xs" wrap="wrap">
          {template ? (
            <ConfirmPopover
              trigger={
                <Button type="button" size="sm" variant="outline" disabled={form.dirty}>
                  アーカイブ
                </Button>
              }
              title="アーカイブ"
              description="アーカイブすると、このテンプレートは編集も送信もできなくなります(バージョン履歴は残ります)。"
              confirmLabel="アーカイブする"
              confirmVariant="destructive"
              onConfirm={form.archive}
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
    <Flex direction="column" gap="lg" className="md:flex-row-reverse md:items-start" data-slot="template-editor">
      <Stack space={4} className="min-w-0 md:w-1/2" data-slot="template-editor-controls">
        {template ? (
          <Flex align="center" justify="between" gap="xs" wrap="wrap" data-slot="template-status-row">
            <Flex align="center" gap="xs" wrap="wrap">
              {form.system ? (
                <SoftBadge variant="secondary" size="md">
                  システム
                </SoftBadge>
              ) : (
                <TemplateStatusBadge
                  status={template.status}
                  currentVersion={template.currentVersion}
                  hasUnpublishedChanges={template.hasUnpublishedChanges}
                  size="md"
                />
              )}
              {form.system ? (
                <Para size="sm" tone="muted" className="my-0">
                  システムテンプレートは編集できません(送信画面で使う白紙のひな形です)
                </Para>
              ) : form.archived ? (
                <Para size="sm" tone="muted" className="my-0">
                  アーカイブ済みのテンプレートは編集できません(バージョン履歴は残ります)
                </Para>
              ) : null}
            </Flex>
            {!form.system ? (
              // 版の履歴はタブにせず、状態の札の横のボタンから重ねたモーダルで見る(作る時は版が無いので出さない)
              <Button type="button" size="sm" variant="ghost" onClick={() => setVersionsOpen(true)} data-slot="template-versions-open">
                <History className="size-4" />
                バージョン履歴
              </Button>
            ) : null}
          </Flex>
        ) : null}

        <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="template-meta">
          <Stack space={1}>
            <Label htmlFor="template-name" className="text-sm">
              テンプレート名
            </Label>
            <Input id="template-name" value={fields.name} disabled={locked} onChange={(e) => fields.setName(e.target.value)} />
          </Stack>
          {form.system ? (
            // システムテンプレートはカテゴリーを持たない(送る画面で選んだカテゴリーで送る)。最初のカテゴリーを出すとその物に見えるので「送信時に選ぶ」
            <KindCategoryFields
              idPrefix="template"
              kinds={fields.kindOptions}
              kind={fields.kind}
              onKindChange={fields.setKind}
              categories={[{ value: SYSTEM_CATEGORY_NOTE, label: "送信時に選ぶ" }]}
              category={SYSTEM_CATEGORY_NOTE}
              onCategoryChange={() => {}}
              disabled
            />
          ) : (
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
          )}
          {form.system ? null : (
            <Stack space={1}>
              <Label htmlFor="template-description" className="text-sm">
                説明(任意)
              </Label>
              <Textarea id="template-description" value={fields.description} rows={2} disabled={locked} onChange={(e) => fields.setDescription(e.target.value)} />
            </Stack>
          )}
        </Stack>

        {form.system ? null : (
          <Stack space={2} className="rounded-md border border-border bg-card p-4" data-slot="template-values">
            {form.layoutFields ? (
              <LayoutFields
                control={form.valuesForm.control}
                fields={form.layoutFields}
                channels={fields.channels}
                activeChannel={preview.channel}
                readOnly={locked}
              />
            ) : (
              <Span size="sm" tone="muted">
                ひな形を選ぶと入力欄が出ます
              </Span>
            )}
          </Stack>
        )}
      </Stack>

      <Stack space={3} className="min-w-0 md:sticky md:top-0 md:w-1/2" data-slot="template-editor-preview">
        <Stack space={1}>
          <Label htmlFor="template-layout" className="text-sm">
            ひな形
          </Label>
          <SelectInput
            id="template-layout"
            value={fields.layout}
            disabled={locked}
            options={fields.layoutOptions.map((item) => ({ value: item.value, label: item.label }))}
            placeholder="ひな形を選択"
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
          // システムテンプレートは白紙(仮の文で描く)なので未入力の印は出さない(D125)
          incompleteChannels={form.system ? undefined : preview.incompleteChannels}
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
        // 高さは固定(送る・文言の編集のモーダルと同じ 85vh)
        maxHeight="85vh"
        height="85vh"
        footer={footer}
        confirmOnClose={form.closeConfirm}
      >
        {textTab}
      </Modal>
      {template && !form.system ? (
        <Modal open={versionsOpen} onOpenChange={setVersionsOpen} title={`バージョン履歴: ${template.name}`} maxWidth="760px">
          <TemplateVersionList versions={versions} currentVersion={template.currentVersion} layouts={options.layouts} />
        </Modal>
      ) : null}
      <Dialog
        open={fields.pendingLayout !== null}
        onOpenChange={(next) => {
          if (!next) fields.cancelLayoutChange();
        }}
        title="ひな形を変更"
        description="ひな形を変えると、入力中の内容はすべて消えます。よろしいですか？"
        showCancelButton
        showConfirmButton
        confirmLabel="変更する"
        confirmVariant="destructive"
        onConfirm={fields.confirmLayoutChange}
      />
      <TemplateEmbeddedInfoModal
        open={embeddedEditor.open}
        onOpenChange={embeddedEditor.setOpen}
        rows={embeddedEditor.rows}
        onUpdateRow={embeddedEditor.updateRow}
        onAddRow={embeddedEditor.addRow}
        onRemoveRow={embeddedEditor.removeRow}
        onApply={() => {
          embeddedEditor.apply();
        }}
        errors={embeddedEditor.errors}
        readOnly={locked}
      />
    </>
  );
}
