// src/features/core/messaging/components/AdminMessageTemplateEditor/index.tsx
// セクションコンテナ(管理: テンプレートを作る・直す)。templateId が無ければ作る、あれば直す。
// 欄: 鍵(作る時だけ)・名前・説明・種類・経路(選択肢は API の options = 受け口の有効な経路)・経路ごとの中身・変数の宣言、
// 使える {{鍵}} の案内(指令 26 の部品 AllowedKeysHint)。操作: 保存・公開・取り下げ(確認つき)。版の履歴(直す時)。
// 書く欄の状態と操作は hook useMessageTemplateForm。作った後はその 1 件の画面へ移る

"use client";

import { useEffect } from "react";

import { Button } from "@/components/Form/Button";
import { Input, SelectInput, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { ConfirmPopover } from "@/components/Overlays/Popover";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { err } from "@/lib/errors";
import { useRouter } from "@/lib/unsavedGuard";

import { AllowedKeysHint } from "@/features/core/messaging/components/common/AllowedKeysHint";
import { TemplateChannelFields } from "@/features/core/messaging/components/common/TemplateChannelFields";
import { TemplateStatusBadge } from "@/features/core/messaging/components/common/TemplateStatusBadge";
import { TemplateVariablesEditor } from "@/features/core/messaging/components/common/TemplateVariablesEditor";
import { TemplateVersionList } from "@/features/core/messaging/components/common/TemplateVersionList";
import { useMessageTemplate, useMessageTemplateOptions } from "@/features/core/messaging/hooks/useMessageTemplate";
import { emptyChannelContent, useMessageTemplateForm } from "@/features/core/messaging/hooks/useMessageTemplateForm";
import { useMessageTemplateVersions } from "@/features/core/messaging/hooks/useMessageTemplateVersions";
import type {
  AdminTemplateDetail,
  AdminTemplateOptions,
} from "@/features/core/messaging/services/client/templateClient";

export type AdminMessageTemplateEditorProps = {
  /** 直す 1 件の id(省略 = 作る) */
  templateId?: string;
  /** 1 件の画面の住所の頭(作った後に移る先。既定 /admin/messaging/templates) */
  basePath?: string;
};

export function AdminMessageTemplateEditor({ templateId, basePath = "/admin/messaging/templates" }: AdminMessageTemplateEditorProps) {
  const { options, error: optionsError } = useMessageTemplateOptions();
  const { template, error, isLoading } = useMessageTemplate(templateId);

  if (!options || (templateId && isLoading && !template)) {
    if (optionsError) return <Para tone="destructive" align="center">{err(optionsError, "選択肢を取得できませんでした")}</Para>;
    return (
      <Flex justify="center" className="py-8">
        <Spinner className="size-6" />
      </Flex>
    );
  }
  if (templateId && !template) {
    return (
      <Para tone="muted" align="center">
        {error ? err(error, "テンプレートを取得できませんでした") : "テンプレートが見つかりません"}
      </Para>
    );
  }
  // 保存・公開の後は 1 件が新しくなるので、書く欄をその値で作り直す
  return (
    <TemplateForm
      key={template ? `${template.id}:${template.updatedAt ?? ""}:${template.currentVersion ?? ""}:${template.status}` : "new"}
      template={template}
      options={options}
      basePath={basePath}
    />
  );
}

function TemplateForm({
  template,
  options,
  basePath,
}: {
  template: AdminTemplateDetail | null;
  options: AdminTemplateOptions;
  basePath: string;
}) {
  const router = useRouter();
  const form = useMessageTemplateForm({ template, options });
  const { fields } = form;
  const { versions } = useMessageTemplateVersions(template?.id);
  const { execute: save, isExecuting: isSaving } = useAsyncAction(form.save);
  const locked = form.archived;

  useEffect(() => {
    if (form.createdId) router.replace(`${basePath}/${encodeURIComponent(form.createdId)}`);
  }, [form.createdId, router, basePath]);

  const channelLabel = (key: string) => options.channels.find((channel) => channel.key === key)?.label ?? key;
  // 経路は選ばない(D85): 使える経路の欄を全部出し、文言を書いた経路がテンプレートの経路になる。
  // 受け口から消えた経路が中身に残っていれば、その経路の欄も見せる(保存の検査で止まる)
  const channelChoices = [
    ...options.channels,
    ...fields.channels.filter((key) => !options.channels.some((c) => c.key === key)).map((key) => ({ key, label: `${key}(使えない経路)` })),
  ];

  return (
    <Stack space={6}>
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
            種類
          </Label>
          <SelectInput
            id="template-category"
            value={fields.category}
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
          <SecTitle as="h2" size="lg">
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

      <Stack space={3} className="rounded-md border border-border bg-card p-4">
        <SecTitle as="h2" size="lg">
          変数
        </SecTitle>
        <TemplateVariablesEditor value={fields.variables} onChange={fields.setVariables} disabled={locked} />
      </Stack>

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

      {template ? (
        <Stack space={3} className="rounded-md border border-border bg-card p-4">
          <SecTitle as="h2" size="lg">
            版の履歴
          </SecTitle>
          <TemplateVersionList versions={versions} currentVersion={template.currentVersion} />
        </Stack>
      ) : null}
    </Stack>
  );
}
