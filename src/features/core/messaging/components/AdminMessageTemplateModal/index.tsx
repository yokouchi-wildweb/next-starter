// src/features/core/messaging/components/AdminMessageTemplateModal/index.tsx
// セクションコンテナ(管理: テンプレートを作る・直すモーダル。D87)。開閉は置き場が持つ(open・onOpenChange・templateId)。
// タブ: 文言(鍵は作る時だけ・名前・説明・カテゴリー・使える {{鍵}} の案内・経路ごとの文言)/ 変数 / 版の履歴(直す時だけ)。
// カテゴリーの選択肢は API の options(種別 announcement・direct・marketing の物だけ。保存の検査はサーバー)。
// 操作の後は onChanged(返った 1 件と操作)を呼ぶ: 一覧が行を足す・置き換える。作った直後・1 件を取る間は読み込み中を出す。
// 操作(下の帯): 取り下げ・公開(ConfirmPopover)・保存。作った後は同じモーダルでその 1 件を直す形に変わる(ページは移らない)。
// 流れは hook useMessageTemplateModal(取る物・タブ・作った後)と useMessageTemplateForm(書く欄・操作)。部品は公開の部品だけなので、
// fork は自分の画面にも同じモーダルを置ける。書きかけのまま閉じる = confirmOnClose、ページの移動 = hook の中の @/lib/unsavedGuard

"use client";

import { Button } from "@/components/Form/Button";
import { Input, SelectInput, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import Modal from "@/components/Overlays/Modal";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import TabbedModal from "@/components/Overlays/TabbedModal";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { err } from "@/lib/errors";

import { AllowedKeysHint } from "@/features/core/messaging/components/common/AllowedKeysHint";
import { TemplateChannelFields } from "@/features/core/messaging/components/common/TemplateChannelFields";
import { TemplateStatusBadge } from "@/features/core/messaging/components/common/TemplateStatusBadge";
import { TemplateVariablesEditor } from "@/features/core/messaging/components/common/TemplateVariablesEditor";
import { TemplateVersionList } from "@/features/core/messaging/components/common/TemplateVersionList";
import {
  emptyChannelContent,
  useMessageTemplateForm,
  type MessageTemplateAction,
} from "@/features/core/messaging/hooks/useMessageTemplateForm";
import { useMessageTemplateModal } from "@/features/core/messaging/hooks/useMessageTemplateModal";
import type { AdminTemplateDetail } from "@/features/core/messaging/services/client/templateClient";

export type AdminMessageTemplateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 直す 1 件の id(null・省略 = 作る) */
  templateId?: string | null;
  /** 作る・保存・公開・取り下げの後(返った 1 件と操作。一覧の取り直し・行の置き換えに使う) */
  onChanged?: (template: AdminTemplateDetail, action: MessageTemplateAction) => void;
};

const MODAL_WIDTH = "880px";

export function AdminMessageTemplateModal({ open, onOpenChange, templateId = null, onChanged }: AdminMessageTemplateModalProps) {
  const m = useMessageTemplateModal({ open, templateId, onChanged });

  if (m.state !== "ready" || !m.options) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={templateId || m.mode === "edit" ? "テンプレートを直す" : "テンプレートを作る"} maxWidth={MODAL_WIDTH}>
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

  // 書く欄は開いた回・1 件の版ごとに作り直す(保存・公開の後はサーバーの値になる)
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
  const { fields } = form;
  const { execute: save, isExecuting: isSaving } = useAsyncAction(form.save);
  const locked = form.archived;

  const channelLabel = (key: string) => options.channels.find((channel) => channel.key === key)?.label ?? key;
  // 経路は選ばない(D85): 使える経路の欄を全部出し、文言を書いた経路がテンプレートの経路になる。
  // 受け口から消えた経路が中身に残っていれば、その経路の欄も見せる(保存の検査で止まる)
  const channelChoices = [
    ...options.channels,
    ...fields.channels.filter((key) => !options.channels.some((c) => c.key === key)).map((key) => ({ key, label: `${key}(使えない経路)` })),
  ];

  const footer = (
    <Stack space={1}>
      <Flex justify="end" gap="xs" wrap="wrap">
        {template && !locked ? (
          <ConfirmPopover
            trigger={
              <Button type="button" size="sm" variant="outline" disabled={form.dirty}>
                取り下げ
              </Button>
            }
            title="取り下げ"
            description="取り下げると、このテンプレートは直せず公開もできなくなります(版の履歴は残ります)。"
            confirmLabel="取り下げる"
            confirmVariant="destructive"
            onConfirm={form.archive}
          />
        ) : null}
        {template && !locked ? (
          <ConfirmPopover
            trigger={
              <Button type="button" size="sm" variant="outline" disabled={!form.canPublish}>
                公開
              </Button>
            }
            title="公開"
            description="今の中身を新しい版として公開します。公開した版は書き換えられません。"
            confirmLabel="公開する"
            onConfirm={form.publish}
          />
        ) : null}
        {!locked ? (
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={isSaving || !form.dirty || form.unknownKeys.length > 0}
            onClick={() => void save()}
          >
            {isSaving ? <Spinner className="size-4" /> : null}
            {template ? "保存" : "下書きを作る"}
          </Button>
        ) : null}
      </Flex>
      {form.dirty && template ? (
        <Para size="sm" tone="muted" align="right" className="my-0">
          公開する前に保存してください
        </Para>
      ) : null}
    </Stack>
  );

  const textTab = (
    <Stack space={4}>
      {template ? (
        <Flex align="center" gap="xs" wrap="wrap">
          <TemplateStatusBadge
            status={template.status}
            currentVersion={template.currentVersion}
            hasUnpublishedChanges={template.hasUnpublishedChanges}
            size="md"
          />
          {locked ? (
            <Para size="sm" tone="muted" className="my-0">
              取り下げたテンプレートは直せません(版の履歴は残ります)
            </Para>
          ) : null}
        </Flex>
      ) : null}

      <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="template-meta">
        {template ? null : (
          <Stack space={1}>
            <Label htmlFor="template-key" className="text-sm">
              鍵(英小文字で始まる英小文字・数字・- _。作った後は変えられない)
            </Label>
            <Input id="template-key" className="font-mono" value={fields.key} onChange={(e) => fields.setKey(e.target.value)} placeholder="例: spring-sale" />
          </Stack>
        )}
        <Stack space={1}>
          <Label htmlFor="template-name" className="text-sm">
            名前
          </Label>
          <Input id="template-name" value={fields.name} disabled={locked} onChange={(e) => fields.setName(e.target.value)} />
        </Stack>
        <Stack space={1}>
          <Label htmlFor="template-description" className="text-sm">
            説明(任意)
          </Label>
          <Textarea id="template-description" value={fields.description} rows={2} disabled={locked} onChange={(e) => fields.setDescription(e.target.value)} />
        </Stack>
        <Stack space={1}>
          <Label htmlFor="template-category" className="text-sm">
            カテゴリー
          </Label>
          <SelectInput
            id="template-category"
            value={fields.category}
            disabled={locked}
            options={options.categories.map((category) => ({ value: category.key, label: category.label }))}
            onChange={(v) => fields.setCategory(v ? String(v) : "")}
          />
        </Stack>
        <Para size="sm" tone="muted" className="my-0">
          文言を書いた経路がテンプレートの経路になります(送る経路は送る時のカテゴリーで決まります)
        </Para>
      </Stack>

      <Stack space={2} className="rounded-md border border-border bg-muted/30 p-4">
        <AllowedKeysHint allowedKeys={form.allowedKeys} unknownKeys={form.unknownKeys} />
      </Stack>

      {channelChoices.map(({ key: channel }) => (
        <Stack key={channel} space={3} className="rounded-md border border-border bg-card p-4">
          <SecTitle as="h3" size="md">
            {channelLabel(channel)}
          </SecTitle>
          <TemplateChannelFields
            channel={channel}
            value={fields.content[channel] ?? emptyChannelContent(channel)}
            onChange={(value) => fields.setChannelContent(channel, value)}
            disabled={locked}
          />
        </Stack>
      ))}
    </Stack>
  );

  const tabs = [
    { value: "text", label: "文言", content: textTab },
    {
      value: "variables",
      label: "変数",
      content: (
        <Stack space={3}>
          <Para size="sm" tone="muted" className="my-0">
            宣言した変数は文言の {"{{鍵}}"} に使えます(送る時に値を入れます)
          </Para>
          <TemplateVariablesEditor value={fields.variables} onChange={fields.setVariables} disabled={locked} />
        </Stack>
      ),
    },
    ...(template
      ? [
          {
            value: "versions",
            label: "版の履歴",
            content: <TemplateVersionList versions={versions} currentVersion={template.currentVersion} />,
            footer: null,
          },
        ]
      : []),
  ];

  return (
    <TabbedModal
      open={open}
      onOpenChange={onOpenChange}
      title={template ? `テンプレートを直す: ${template.name}` : "テンプレートを作る"}
      maxWidth={MODAL_WIDTH}
      tabs={tabs}
      value={modal.tab}
      onValueChange={modal.setTab}
      ariaLabel="テンプレートのタブ"
      footer={footer}
      confirmOnClose={form.closeConfirm}
    />
  );
}
