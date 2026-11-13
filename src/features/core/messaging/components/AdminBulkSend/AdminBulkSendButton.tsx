// src/features/core/messaging/components/AdminBulkSend/AdminBulkSendButton.tsx
// 管理一覧の一括操作「一括送信」のボタン。選んだ記録 → (サーバーの bulkSendTargets の項目が)利用者 → 選んだカテゴリーの種別の管理の定義(messaging.adminDirect など)。
// 流れ: ボタン → 書く(経路: メール / サービス内のお知らせ、種別)→ 確かめる(Dialog)→ 結果(数・後処理・回へのリンク)。
// 記録 → 利用者の解決と送った後の業務の処理(管理メモの追記など)はサーバーの項目が持つ(D42)。画面は target の鍵だけを送る。
// 書く欄・送信の流れは hook useAdminBulkSendForm(部品は描くだけ)

"use client";

import { AlertCircle, CheckCircle2, Mail } from "lucide-react";

import { SolidBadge } from "@/components/Badge";
import { Button, LinkButton } from "@/components/Form/Button";
import { Input, SelectInput, SwitchInput, Textarea } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Dialog } from "@/components/Overlays/Dialog";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";

import {
  useAdminBulkSendForm,
  type UseAdminBulkSendFormOptions,
} from "@/features/core/messaging/hooks/useAdminBulkSendForm";
import type { AdminBulkSendResult } from "@/features/core/messaging/services/client/adminMessagingClient";

export type { AdminBulkSendDefaults } from "@/features/core/messaging/hooks/useAdminBulkSendForm";

export type AdminBulkSendButtonProps = UseAdminBulkSendFormOptions & {
  /** 記録の名詞(文に入る。例: "振込レビュー") */
  recordNoun: string;
  /** カテゴリーを画面で選べるか(既定 true。false = defaultCategory で送る) */
  categorySelectable?: boolean;
  /** 件名の placeholder */
  subjectPlaceholder?: string;
  /** ボタンの文言(既定「一括送信」) */
  label?: string;
  disabled?: boolean;
};

const CHANNEL_LABELS: Record<string, string> = { email: "メール", inApp: "サービス内のお知らせ" };

export function AdminBulkSendButton({
  recordNoun,
  categorySelectable = true,
  subjectPlaceholder = "例: 重要なお知らせ",
  label = "一括送信",
  disabled = false,
  ...formOptions
}: AdminBulkSendButtonProps) {
  const form = useAdminBulkSendForm(formOptions);
  const { fields } = form;
  const count = formOptions.ids.length;
  const channelText = [fields.useEmail ? "メール" : null, fields.useInApp ? "サービス内のお知らせ" : null]
    .filter(Boolean)
    .join("と");

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={disabled || count === 0} onClick={() => form.setOpen(true)}>
        <Mail className="size-4" />
        {label}
      </Button>

      <Modal open={form.formOpen} onOpenChange={form.setOpen} title={label} maxWidth={640} maxHeight="80vh">
        <Stack space={5} className="px-1 py-2">
          <Para size="sm" tone="muted" className="my-0">
            選んだ {count} 件の{recordNoun}に紐づく利用者へ送ります(同じ利用者には 1 通にまとめます)。
          </Para>

          {categorySelectable ? (
            <Stack space={2}>
              <Label htmlFor="admin-bulk-send-category" className="text-sm font-medium">
                カテゴリー
              </Label>
              <SelectInput
                id="admin-bulk-send-category"
                value={fields.category}
                onChange={(value) => fields.setCategory(String(value ?? ""))}
                options={fields.categories.map((option) => ({ value: option.key, label: option.label }))}
              />
            </Stack>
          ) : null}

          <SwitchInput size="sm" value={fields.useEmail} onChange={fields.setUseEmail} label="メールを送る" />
          {fields.useEmail ? (
            <>
              <Stack space={2}>
                <Label htmlFor="admin-bulk-send-subject" className="text-sm font-medium">
                  メールの件名
                </Label>
                <Input
                  id="admin-bulk-send-subject"
                  value={fields.emailSubject}
                  onChange={(e) => fields.setEmailSubject(e.target.value)}
                  placeholder={subjectPlaceholder}
                />
              </Stack>
              <Stack space={2}>
                <Label htmlFor="admin-bulk-send-body" className="text-sm font-medium">
                  メールの本文
                </Label>
                <Textarea
                  id="admin-bulk-send-body"
                  value={fields.emailBody}
                  onChange={(e) => fields.setEmailBody(e.target.value)}
                  placeholder="プレーンテキストで入力。改行はそのまま反映されます。"
                  rows={8}
                />
              </Stack>
            </>
          ) : null}

          <SwitchInput
            size="sm"
            value={fields.useInApp}
            onChange={fields.setUseInApp}
            label="サービス内のお知らせを送る"
            description="利用者の画面のお知らせに表示されます。"
          />
          {fields.useInApp ? (
            <>
              <Stack space={2}>
                <Label htmlFor="admin-bulk-send-inapp-title" className="text-sm font-medium">
                  お知らせの題
                </Label>
                <Input
                  id="admin-bulk-send-inapp-title"
                  value={fields.inAppTitle}
                  onChange={(e) => fields.setInAppTitle(e.target.value)}
                  placeholder="例: メールをご確認ください"
                />
              </Stack>
              <Stack space={2}>
                <Label htmlFor="admin-bulk-send-inapp-body" className="text-sm font-medium">
                  お知らせの本文
                </Label>
                <Textarea
                  id="admin-bulk-send-inapp-body"
                  value={fields.inAppBody}
                  onChange={(e) => fields.setInAppBody(e.target.value)}
                  rows={4}
                />
              </Stack>
            </>
          ) : null}

          <Flex justify="end" gap="xs" className="pt-2">
            <Button size="sm" variant="outline" onClick={() => form.setOpen(false)}>
              キャンセル
            </Button>
            <Button size="sm" variant="primary" onClick={() => form.setConfirmOpen(true)} disabled={!form.isValid}>
              送信
            </Button>
          </Flex>
        </Stack>
      </Modal>

      <Dialog
        open={form.confirmOpen}
        onOpenChange={form.setConfirmOpen}
        layer="alert"
        overlayLayer="alert"
        title="送信の確認"
        description={`選んだ ${count} 件の${recordNoun}に紐づく利用者へ、${channelText}を送ります。よろしいですか？`}
        confirmLabel="送信する"
        cancelLabel="キャンセル"
        onConfirm={form.submit}
      />

      <Modal
        open={form.result !== null}
        onOpenChange={(open) => {
          if (!open) form.closeResult();
        }}
        title="送信の結果"
        maxWidth={520}
      >
        {form.result ? <AdminBulkSendResultView result={form.result} recordNoun={recordNoun} /> : null}
      </Modal>
    </>
  );
}

/** 送信の結果(数・経路ごとの数・後処理・回へのリンク) */
function AdminBulkSendResultView({ result, recordNoun }: { result: AdminBulkSendResult; recordNoun: string }) {
  const { counts, afterSend, dispatchId } = result;
  const channelEntries = Object.entries(counts.channelCounts ?? {});
  return (
    <Stack space={4} className="px-1 py-2">
      <Para size="sm" tone="muted" className="my-0">
        宛先の利用者: {counts.recipientCount} 名(重複を除く)
        {counts.queuedCount > 0 ? ` / 順に送る配達: ${counts.queuedCount} 件` : ""}
      </Para>

      {channelEntries.map(([channel, c]) => (
        <Stack key={channel} space={2}>
          <span className="text-sm font-medium">{CHANNEL_LABELS[channel] ?? channel}</span>
          <Flex align="center" gap="xs" wrap="wrap" className="pl-2">
            <SolidBadge variant="success" size="sm">
              送信 {c.sent}
            </SolidBadge>
            <SolidBadge variant={c.failed > 0 ? "destructive" : "muted"} size="sm">
              失敗 {c.failed}
            </SolidBadge>
            {c.suppressed > 0 ? (
              <SolidBadge variant="muted" size="sm">
                停止中 {c.suppressed}
              </SolidBadge>
            ) : null}
            {c.skipped_no_address > 0 ? (
              <SolidBadge variant="muted" size="sm">
                宛先なし {c.skipped_no_address}
              </SolidBadge>
            ) : null}
          </Flex>
        </Stack>
      ))}

      {afterSend ? (
        <Flex align="center" gap="xs">
          {afterSend.ok ? (
            <CheckCircle2 className="size-4 text-success-text" />
          ) : (
            <AlertCircle className="size-4 text-destructive-text" />
          )}
          <span className="text-sm">
            {afterSend.ok
              ? `${recordNoun}の送った後の処理を終えました`
              : `${recordNoun}の送った後の処理に失敗しました: ${afterSend.error}`}
          </span>
        </Flex>
      ) : null}

      {dispatchId ? (
        <Flex justify="end" className="pt-2">
          <LinkButton href={`/admin/messaging/${encodeURIComponent(dispatchId)}`} size="sm" variant="outline">
            送信の詳細を見る
          </LinkButton>
        </Flex>
      ) : null}
    </Stack>
  );
}
