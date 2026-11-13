// src/features/core/messaging/components/AdminMessageComposer/index.tsx
// セクションコンテナ(管理: 連絡を送る)。中身(公開中のテンプレート or その場で書く)・経路・宛先・カテゴリー・予約・
// プレビュー・自分へのテスト送信・送る(宛先数の見込みつきの確認)。結果から送った回の画面へ。
// 書く欄の状態と操作は hook useAdminSendComposer。取引の連絡は選んだ利用者宛ての時だけ選べる(D40)

"use client";

import { useState } from "react";

import { SoftBadge } from "@/components/Badge";
import { Button, LinkButton } from "@/components/Form/Button";
import {
  DatetimeInput,
  Input,
  MultiSelectInput,
  RadioGroupInput,
  SelectInput,
  SwitchInput,
  Textarea,
} from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Dialog } from "@/components/Overlays/Dialog";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { UserAsyncMultiSelect } from "@/features/core/user/components/common/UserAsyncMultiSelect";
import { MessagePreview } from "@/features/core/messaging/components/common/MessagePreview";
import { useAdminSendComposer } from "@/features/core/messaging/hooks/useAdminSendComposer";
import { useAdminSendOptions } from "@/features/core/messaging/hooks/useAdminSendOptions";
import type { AdminSendOptions, RecipientEstimate } from "@/features/core/messaging/services/client/sendClient";

export type AdminMessageComposerProps = {
  /** 送った回の画面の住所の頭(既定 /admin/messaging) */
  dispatchBasePath?: string;
};

const SOURCE_OPTIONS = [
  { value: "template", label: "テンプレート" },
  { value: "adhoc", label: "ここで書く" },
];
const AUDIENCE_OPTIONS = [
  { value: "all", label: "全員" },
  { value: "role", label: "ロール" },
  { value: "audience", label: "宛先の集め方" },
  { value: "users", label: "選んだ利用者" },
];
const SCHEDULE_OPTIONS = [
  { value: "now", label: "今送る" },
  { value: "at", label: "予約する" },
];

export function AdminMessageComposer(props: AdminMessageComposerProps) {
  const { options, error } = useAdminSendOptions();
  if (!options) {
    if (error) return <Para tone="destructive" align="center">{err(error, "送る画面の選択肢を取得できませんでした")}</Para>;
    return (
      <Flex justify="center" className="py-8">
        <Spinner className="size-6" />
      </Flex>
    );
  }
  return <Composer options={options} {...props} />;
}

function Composer({ options, dispatchBasePath = "/admin/messaging" }: AdminMessageComposerProps & { options: AdminSendOptions }) {
  const { showToast } = useToast();
  const composer = useAdminSendComposer(options);
  const { fields, template } = composer;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [estimate, setEstimate] = useState<RecipientEstimate | null>(null);

  const { execute: preview, isExecuting: isPreviewing } = useAsyncAction(async () => {
    try {
      await composer.runPreview();
    } catch (e) {
      showToast(err(e, "プレビューを作れませんでした"), "error");
    }
  });
  const { execute: sendTest, isExecuting: isTesting } = useAsyncAction(async () => {
    try {
      await composer.sendTest();
      showToast("自分にテスト送信しました", "success");
    } catch (e) {
      showToast(err(e, "テスト送信できませんでした"), "error");
    }
  });
  const { execute: openConfirm, isExecuting: isEstimating } = useAsyncAction(async () => {
    try {
      setEstimate(await composer.runEstimate());
      setConfirmOpen(true);
    } catch (e) {
      showToast(err(e, "宛先の数を見込めませんでした"), "error");
    }
  });
  const handleSend = async () => {
    try {
      await composer.send();
      setConfirmOpen(false);
      showToast(fields.scheduleMode === "at" ? "予約しました" : "送信を受け付けました", "success");
    } catch (e) {
      setConfirmOpen(false);
      showToast(err(e, "送れませんでした"), "error");
    }
  };

  if (composer.sent) {
    return (
      <Stack space={4} className="rounded-md border border-border bg-card p-4">
        <SecTitle as="h2" size="lg">
          {composer.sent.status === "scheduled" ? "予約しました" : "送信を受け付けました"}
        </SecTitle>
        <Para size="sm" className="my-0">
          状態: {composer.sent.status}
          {composer.sent.queuedCount > 0 ? ` / 順に送る配達 ${composer.sent.queuedCount} 件` : ""}
        </Para>
        <Flex gap="xs" wrap="wrap">
          {composer.sent.dispatchId ? (
            <LinkButton href={`${dispatchBasePath}/${encodeURIComponent(composer.sent.dispatchId)}`} size="sm" variant="primary">
              送った回を見る
            </LinkButton>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={composer.reset}>
            もう 1 通書く
          </Button>
        </Flex>
      </Stack>
    );
  }

  const adhocChannels = options.channels.filter((channel) => channel.adhoc);
  const templateChannels = template ? options.channels.filter((channel) => template.channels.includes(channel.key)) : [];
  const channelChoices = fields.source === "template" ? templateChannels : adhocChannels;
  const scheduleNote = `予約の粒度は cron の周期です(Vercel Hobby では 1 日 1 回なので、時刻より遅れて送られます)。${options.maxScheduleDays} 日先まで予約できます。`;

  return (
    <Stack space={6}>
      {/* 中身 */}
      <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="composer-content">
        <SecTitle as="h2" size="lg">
          中身
        </SecTitle>
        <RadioGroupInput
          value={fields.source}
          options={SOURCE_OPTIONS}
          onChange={(v) => fields.setSource(v === "template" ? "template" : "adhoc")}
        />
        {fields.source === "template" ? (
          <Stack space={3}>
            {options.templates.length === 0 ? (
              <Para size="sm" tone="muted" className="my-0">
                公開中のテンプレートがありません
              </Para>
            ) : (
              <SelectInput
                aria-label="テンプレート"
                value={fields.templateId}
                options={options.templates.map((item) => ({ value: item.id, label: `${item.name}(v${item.currentVersion})` }))}
                onChange={(v) => fields.setTemplateId(v ? String(v) : "")}
                placeholder="テンプレートを選ぶ"
              />
            )}
            {template
              ? template.variables
                  .filter((variable) => variable.source === "dispatch")
                  .map((variable) => (
                    <Stack key={variable.key} space={1}>
                      <Label htmlFor={`composer-var-${variable.key}`} className="text-sm">
                        {variable.label || variable.key}
                        {variable.required ? "(必須)" : ""}
                        <Span size="xs" tone="muted" className="ml-2 font-mono">{`{{${variable.key}}}`}</Span>
                      </Label>
                      <Input
                        id={`composer-var-${variable.key}`}
                        type={variable.type === "number" ? "number" : "text"}
                        value={fields.varValues[variable.key] ?? ""}
                        placeholder={variable.default !== undefined ? `既定: ${String(variable.default)}` : undefined}
                        onChange={(e) => fields.setVarValue(variable.key, e.target.value)}
                      />
                    </Stack>
                  ))
              : null}
          </Stack>
        ) : null}

        <Stack space={1}>
          <Label className="text-sm">経路</Label>
          <Flex gap="sm" wrap="wrap">
            {channelChoices.map((channel) => (
              <SwitchInput
                key={channel.key}
                size="sm"
                value={fields.channels.includes(channel.key)}
                onChange={(on) => fields.toggleChannel(channel.key, on)}
                label={channel.label}
              />
            ))}
          </Flex>
        </Stack>

        {fields.source === "adhoc" && fields.channels.includes("email") ? (
          <Stack space={2}>
            <Label htmlFor="composer-email-subject" className="text-sm">
              メールの件名
            </Label>
            <Input id="composer-email-subject" value={fields.emailSubject} onChange={(e) => fields.setEmailSubject(e.target.value)} />
            <Label htmlFor="composer-email-body" className="text-sm">
              メールの本文
            </Label>
            <Textarea id="composer-email-body" value={fields.emailBody} rows={8} onChange={(e) => fields.setEmailBody(e.target.value)} />
          </Stack>
        ) : null}
        {fields.source === "adhoc" && fields.channels.includes("inApp") ? (
          <Stack space={2}>
            <Label htmlFor="composer-inapp-title" className="text-sm">
              お知らせの題
            </Label>
            <Input id="composer-inapp-title" value={fields.inAppTitle} onChange={(e) => fields.setInAppTitle(e.target.value)} />
            <Label htmlFor="composer-inapp-body" className="text-sm">
              お知らせの本文
            </Label>
            <Textarea id="composer-inapp-body" value={fields.inAppBody} rows={4} onChange={(e) => fields.setInAppBody(e.target.value)} />
          </Stack>
        ) : null}
        {composer.contentError ? (
          <Para size="sm" tone="muted" className="my-0">
            {composer.contentError}
          </Para>
        ) : null}
      </Stack>

      {/* 宛先とカテゴリー */}
      <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="composer-audience">
        <SecTitle as="h2" size="lg">
          宛先
        </SecTitle>
        <RadioGroupInput
          value={fields.audienceType}
          options={AUDIENCE_OPTIONS}
          onChange={(v) => fields.setAudienceType((v as "all" | "role" | "audience" | "users") ?? "all")}
        />
        {fields.audienceType === "role" ? (
          <MultiSelectInput
            aria-label="ロール"
            value={fields.roles}
            options={options.roles.map((role) => ({ value: role.id, label: role.label }))}
            onChange={(v) => fields.setRoles((v ?? []).map(String))}
          />
        ) : null}
        {fields.audienceType === "audience" ? (
          options.audiences.length === 0 ? (
            <Para size="sm" tone="muted" className="my-0">
              宛先の集め方はありません(fork が audiences の受け口に足す)
            </Para>
          ) : (
            <SelectInput
              aria-label="宛先の集め方"
              value={fields.audienceKey}
              options={options.audiences.map((audience) => ({ value: audience.key, label: audience.label }))}
              onChange={(v) => fields.setAudienceKey(v ? String(v) : "")}
            />
          )
        ) : null}
        {fields.audienceType === "users" ? (
          <UserAsyncMultiSelect value={fields.userIds} onChange={(v) => fields.setUserIds(v.map(String))} />
        ) : null}
        <Stack space={1}>
          <Label htmlFor="composer-category" className="text-sm">
            カテゴリー
          </Label>
          <SelectInput
            id="composer-category"
            value={fields.category}
            options={composer.allowedCategories.map((option) => ({ value: option.key, label: option.label }))}
            onChange={(v) => fields.setCategory(String(v ?? ""))}
          />
          <Span size="xs" tone="muted">
            宛先によって選べるカテゴリーが変わります(運営からの個別の連絡は選んだ利用者宛ての時だけ)
          </Span>
        </Stack>
        {composer.audienceError ? (
          <Para size="sm" tone="muted" className="my-0">
            {composer.audienceError}
          </Para>
        ) : null}
      </Stack>

      {/* 予約 */}
      <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="composer-schedule">
        <SecTitle as="h2" size="lg">
          送る時刻
        </SecTitle>
        <RadioGroupInput
          value={fields.scheduleMode}
          options={SCHEDULE_OPTIONS}
          onChange={(v) => fields.setScheduleMode(v === "at" ? "at" : "now")}
        />
        {fields.scheduleMode === "at" ? (
          <Stack space={1}>
            <DatetimeInput aria-label="予約の時刻" value={fields.scheduledAt} outputFormat="iso" onValueChange={fields.setScheduledAt} />
            <Para size="xs" tone="muted" className="my-0">
              {scheduleNote}
            </Para>
            {composer.scheduleError ? (
              <Para size="sm" tone="destructive" className="my-0">
                {composer.scheduleError}
              </Para>
            ) : null}
          </Stack>
        ) : null}
      </Stack>

      {/* 操作 */}
      <Flex justify="end" gap="xs" wrap="wrap">
        <Button type="button" size="sm" variant="outline" disabled={Boolean(composer.contentError) || isPreviewing} onClick={() => void preview()}>
          {isPreviewing ? <Spinner className="size-4" /> : null}
          プレビュー
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={Boolean(composer.contentError) || isTesting} onClick={() => void sendTest()}>
          {isTesting ? <Spinner className="size-4" /> : null}
          自分にテスト送信
        </Button>
        <Button type="button" size="sm" variant="primary" disabled={!composer.canSend || isEstimating} onClick={() => void openConfirm()}>
          {isEstimating ? <Spinner className="size-4" /> : null}
          {fields.scheduleMode === "at" ? "予約する" : "送る"}
        </Button>
      </Flex>

      {composer.preview ? (
        <Stack space={3} className="rounded-md border border-border bg-card p-4" data-slot="composer-preview">
          <Flex align="center" gap="xs" wrap="wrap">
            <SecTitle as="h2" size="lg">
              プレビュー
            </SecTitle>
            <SoftBadge variant="muted" size="sm">
              見本の宛先 = あなた
            </SoftBadge>
            {composer.preview.template ? (
              <SoftBadge variant="info" size="sm">
                v{composer.preview.template.version} で送る
              </SoftBadge>
            ) : null}
          </Flex>
          <MessagePreview channels={composer.preview.channels} />
        </Stack>
      ) : null}

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        layer="alert"
        overlayLayer="alert"
        title={fields.scheduleMode === "at" ? "予約の確認" : "送信の確認"}
        description={confirmText(estimate, fields.scheduleMode === "at" ? fields.scheduledAt : null, template?.currentVersion ?? null)}
        confirmLabel={fields.scheduleMode === "at" ? "予約する" : "送る"}
        cancelLabel="キャンセル"
        onConfirm={handleSend}
      />
    </Stack>
  );
}

function confirmText(estimate: RecipientEstimate | null, scheduledAt: string | null, version: number | null): string {
  const count = estimate ? `${estimate.count}${estimate.capped ? " 名以上" : " 名"}` : "?";
  const when = scheduledAt ? `${new Date(scheduledAt).toLocaleString("ja-JP")} に予約します` : "今送ります";
  const pinned = version ? `テンプレートは v${version} で送ります(${scheduledAt ? "予約の時点の公開版を固定" : "送る時点の公開版"})。` : "";
  return `宛先の見込み: ${count}(宛先の数は送る時に確定し直します)。${when}。${pinned}よろしいですか？`;
}
