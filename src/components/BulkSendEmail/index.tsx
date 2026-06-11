// src/components/BulkSendEmail/index.tsx

"use client";

import { useState, useCallback, useMemo } from "react";
import { Mail, AlertCircle, CheckCircle2 } from "lucide-react";

import Modal from "@/components/Overlays/Modal";
import { Dialog } from "@/components/Overlays/Dialog";
import { Button } from "@/components/Form/Button";
import { Input } from "@/components/Form/Input/Manual/Input";
import { Textarea } from "@/components/Form/Input/Manual/Textarea";
import { SwitchInput } from "@/components/Form/Input/Manual/SwitchInput";
import { Label } from "@/components/Form/Label";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { SolidBadge } from "@/components/Badge";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";

import type { BulkSendEmailInput, BulkSendEmailResult } from "./types";

export type {
  BulkSendEmailInput,
  BulkSendEmailResult,
  BulkSendEmailFailure,
} from "./types";

export type BulkSendEmailButtonProps = {
  /** 送信対象レコードの ID 配列 */
  ids: string[];
  /**
   * 一斉送信処理。選択 ID と入力内容を受け取り結果を返す。
   * ドメインごとのクライアント関数を渡す。
   */
  onSend: (input: BulkSendEmailInput) => Promise<BulkSendEmailResult>;
  /**
   * 対象レコードの名詞。文面に埋め込まれる。
   * 例: "発送リクエスト" / "振込レビュー"
   */
  recordNoun: string;
  /** 通知タイトルの初期値 */
  defaultNotificationTitle: string;
  /** 通知本文の初期値 */
  defaultNotificationBody: string;
  /** メール件名入力の placeholder（任意） */
  subjectPlaceholder?: string;
  /** 送信成功時のコールバック（選択解除・一覧再取得など） */
  onSuccess?: () => void;
};

/**
 * バルクアクション「メール一斉送信」共通ボタン。
 *
 * - 選択された複数レコードに紐づくユーザーへ、自由入力の件名／本文でメールを一斉送信する
 * - メールは1ユーザー1通（重複ユーザーは1通に集約される）
 * - サービス内お知らせ通知の同時発行はスイッチで切替（デフォルト ON）
 * - 送信処理自体は onSend（ドメイン固有のクライアント関数）に委譲する
 * - 送信成功後の一覧再取得は onSuccess に委譲する
 *   （SSR は router.refresh、SWR は mutate など実行環境差を吸収するため、
 *    このコンポーネントでは再取得手段を持たない）
 */
export function BulkSendEmailButton({
  ids,
  onSend,
  recordNoun,
  defaultNotificationTitle,
  defaultNotificationBody,
  subjectPlaceholder = "例: 重要なお知らせ",
  onSuccess,
}: BulkSendEmailButtonProps) {
  const { showToast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BulkSendEmailResult | null>(null);

  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendNotification, setSendNotification] = useState(true);
  const [notificationTitle, setNotificationTitle] = useState(
    defaultNotificationTitle,
  );
  const [notificationBody, setNotificationBody] = useState(
    defaultNotificationBody,
  );

  const count = ids.length;

  const isFormValid = useMemo(() => {
    if (!emailSubject.trim() || !emailBody.trim()) return false;
    if (sendNotification) {
      if (!notificationTitle.trim() || !notificationBody.trim()) return false;
    }
    return true;
  }, [emailSubject, emailBody, sendNotification, notificationTitle, notificationBody]);

  const resetForm = useCallback(() => {
    setEmailSubject("");
    setEmailBody("");
    setSendNotification(true);
    setNotificationTitle(defaultNotificationTitle);
    setNotificationBody(defaultNotificationBody);
  }, [defaultNotificationTitle, defaultNotificationBody]);

  const handleFormOpenChange = useCallback(
    (open: boolean) => {
      if (isSubmitting) return;
      setFormOpen(open);
      if (!open) resetForm();
    },
    [isSubmitting, resetForm],
  );

  const handleClickSend = useCallback(() => {
    if (!isFormValid) return;
    setConfirmOpen(true);
  }, [isFormValid]);

  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true);
    showToast({
      message: `${count}件の${recordNoun}にメール送信中…`,
      variant: "loading",
      mode: "persistent",
    });

    try {
      const res = await onSend({
        ids,
        emailSubject: emailSubject.trim(),
        emailBody: emailBody.trim(),
        sendNotification,
        notificationTitle: sendNotification ? notificationTitle.trim() : undefined,
        notificationBody: sendNotification ? notificationBody.trim() : undefined,
      });
      setResult(res);
      setConfirmOpen(false);
      setFormOpen(false);
      setResultOpen(true);
      showToast("メール送信処理が完了しました", "success");
      onSuccess?.();
    } catch (error) {
      showToast(err(error, "メール送信に失敗しました"), "error");
      setConfirmOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    ids,
    count,
    recordNoun,
    onSend,
    emailSubject,
    emailBody,
    sendNotification,
    notificationTitle,
    notificationBody,
    showToast,
    onSuccess,
  ]);

  const handleResultOpenChange = useCallback(
    (open: boolean) => {
      setResultOpen(open);
      if (!open) {
        setResult(null);
        resetForm();
      }
    },
    [resetForm],
  );

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={count === 0}
        onClick={() => setFormOpen(true)}
      >
        <Mail className="h-4 w-4" />
        メール一斉送信
      </Button>

      {/* 入力モーダル */}
      <Modal
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        title="メール一斉送信"
        maxWidth={640}
        maxHeight="80vh"
      >
        <Stack space={5} className="px-1 py-2">
          <Para size="sm" tone="muted" className="my-0">
            選択された {count} 件の{recordNoun}に紐づくユーザー
            （重複は自動的に1通にまとめられます）にメールを一斉送信します。
            送信後、選択された{recordNoun}の管理者メモに送信記録を追記します。
          </Para>

          <Stack space={2}>
            <Label htmlFor="bulk-email-subject" className="text-sm font-medium">
              メール件名
            </Label>
            <Input
              id="bulk-email-subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={subjectPlaceholder}
              disabled={isSubmitting}
            />
          </Stack>

          <Stack space={2}>
            <Label htmlFor="bulk-email-body" className="text-sm font-medium">
              メール本文
            </Label>
            <Textarea
              id="bulk-email-body"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="プレーンテキストで入力。改行はそのまま反映されます。"
              rows={8}
              disabled={isSubmitting}
            />
          </Stack>

          <div className="border-t border-border" />

          <SwitchInput
            size="sm"
            value={sendNotification}
            onChange={setSendNotification}
            label="サービス内のお知らせ通知も同時に送信する"
            description="メール確認を促す補助通知としてユーザー画面に表示されます。"
            disabled={isSubmitting}
          />

          {sendNotification && (
            <>
              <Stack space={2}>
                <Label htmlFor="bulk-notification-title" className="text-sm font-medium">
                  通知タイトル
                </Label>
                <Input
                  id="bulk-notification-title"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  placeholder="例: メールをご確認ください"
                  disabled={isSubmitting}
                />
              </Stack>

              <Stack space={2}>
                <Label htmlFor="bulk-notification-body" className="text-sm font-medium">
                  通知本文
                </Label>
                <Textarea
                  id="bulk-notification-body"
                  value={notificationBody}
                  onChange={(e) => setNotificationBody(e.target.value)}
                  rows={4}
                  disabled={isSubmitting}
                />
              </Stack>
            </>
          )}

          <Flex justify="end" gap="xs" className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleFormOpenChange(false)}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleClickSend}
              disabled={!isFormValid || isSubmitting}
            >
              送信
            </Button>
          </Flex>
        </Stack>
      </Modal>

      {/* 確認ダイアログ（モーダル上に重ねて表示） */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setConfirmOpen(open);
        }}
        layer="alert"
        overlayLayer="alert"
        title="メール送信の確認"
        description={
          sendNotification
            ? `選択された ${count} 件の${recordNoun}に紐づくユーザーへ、メールとお知らせ通知を送信します。よろしいですか？`
            : `選択された ${count} 件の${recordNoun}に紐づくユーザーへ、メールを送信します。よろしいですか？`
        }
        confirmLabel="送信する"
        cancelLabel="キャンセル"
        onConfirm={handleConfirm}
      />

      {/* 送信結果モーダル */}
      <Modal
        open={resultOpen}
        onOpenChange={handleResultOpenChange}
        title="送信結果"
        maxWidth={520}
      >
        {result && (
          <Stack space={4} className="px-1 py-2">
            <Para size="sm" tone="muted" className="my-0">
              送信対象ユーザー数: {result.targetUserCount} 名（重複排除済み）
            </Para>

            <Stack space={2}>
              <Flex align="center" gap="xs">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">メール送信</span>
              </Flex>
              <Flex align="center" gap="xs" className="pl-6">
                <SolidBadge variant="success" size="sm">
                  成功 {result.emailSentCount}
                </SolidBadge>
                <SolidBadge
                  variant={result.emailFailedCount > 0 ? "destructive" : "muted"}
                  size="sm"
                >
                  失敗 {result.emailFailedCount}
                </SolidBadge>
              </Flex>
            </Stack>

            {result.notificationCreated !== null && (
              <Stack space={2}>
                <Flex align="center" gap="xs">
                  {result.notificationCreated ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">サービス内お知らせ通知</span>
                </Flex>
                <div className="pl-6 text-sm">
                  {result.notificationCreated
                    ? `発行成功（${result.targetUserCount} 名宛）`
                    : "発行失敗（サーバーログを確認してください）"}
                </div>
              </Stack>
            )}

            <Stack space={1}>
              <span className="text-sm font-medium">管理者メモ追記</span>
              <span className="pl-1 text-sm text-muted-foreground">
                {result.memoAppendedCount} 件の{recordNoun}に送信記録を追記しました。
              </span>
            </Stack>

            {result.emailFailures.length > 0 && (
              <Stack space={2}>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  メール送信に失敗したユーザー
                </span>
                <ul className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-3 text-xs">
                  {result.emailFailures.map((f) => (
                    <li key={f.userId} className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <div>
                        <div className="font-mono">
                          {f.email ?? "(メール未登録)"}
                        </div>
                        <div className="text-muted-foreground">{f.reason}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Stack>
            )}

            <Flex justify="end" className="pt-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleResultOpenChange(false)}
              >
                閉じる
              </Button>
            </Flex>
          </Stack>
        )}
      </Modal>
    </>
  );
}

export default BulkSendEmailButton;
