// src/features/core/purchaseRequest/components/BankTransferInstructionPage/ConfirmTransferModal.tsx
//
// ③ 振込完了の申告モーダル。
// 構成:
//   1. ② で添付された振込明細画像のプレビュー（最終確認）
//   2. 不正利用に関する注意書き（destructive 色で強調）
//   3. キャンセル / この内容で申告する のフッターボタン
//
// 「申告する」を押すと confirmBankTransfer API を呼び、成功時はサーバーから返る
// redirectUrl（完了画面）にリダイレクトする。送信中はモーダルを閉じられないようにする
// （二重送信防止 + 状態の不整合回避）。

"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { mutate as swrMutate } from "swr";

import Modal from "@/components/Overlays/Modal";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Button } from "@/components/Form/Button/Button";
import { BooleanCheckboxInput } from "@/components/Form/Input/Manual/BooleanCheckboxInput";
import { Para, Span } from "@/components/TextBlocks";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors/httpError";
import { useAsyncAction } from "@/hooks/useAsyncAction";

import { submitBankTransferProof } from "@/features/core/bankTransferReview";

/** useActiveBankTransfer の SWR key と一致させる */
const ACTIVE_BANK_TRANSFER_KEY = "/api/wallet/purchase/bank-transfer/active";

/**
 * サーバーから受け取った redirectUrl が「同一オリジン内の相対 URL」かを検証する。
 * - 先頭が "/" で始まる
 * - "//evil.com" のようなプロトコル相対 URL を排除
 * 万が一サーバー応答が改竄された場合の Open Redirect への defense-in-depth。
 */
function isSafeRelativeRedirect(url: string): boolean {
  if (typeof url !== "string" || url === "") return false;
  return url.startsWith("/") && !url.startsWith("//");
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  /** ② で添付した振込明細画像の Storage URL */
  proofImageUrl: string;
};

export function ConfirmTransferModal({ open, onOpenChange, requestId, proofImageUrl }: Props) {
  // 同意チェックは「ご注意」を読んだ上での確定アクションとして必須にする。
  // モーダルを開くたびに未チェック状態に戻す（毎回の確認を強制）
  const [agreed, setAgreed] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) setAgreed(false);
  }, [open]);

  // useAsyncAction: useRef ベースの排他ロックで二重送信を確実に防止する。
  // setState ベースの guard では state 更新の非同期性で稀に race するため、
  // 不可逆操作 (申告 = 通貨付与) ではこちらを使う。
  const { execute, isExecuting: isSubmitting } = useAsyncAction(async () => {
    if (!agreed) return;
    try {
      // mode に応じてサーバー側が redirectUrl を返す:
      //   - immediate          → /wallet/[slug]/purchase/complete?...
      //   - approval_required  → /wallet/[slug]/purchase/awaiting-review
      const result = await submitBankTransferProof({
        purchaseRequestId: requestId,
        proofImageUrl,
      });

      // 申告完了で active 状態（pending_review / pre_submit）が変わるため SWR キャッシュを無効化。
      // 通常は直後の window.location.href で full reload されるが、redirectUrl が空のフォールバック
      // パスや別タブでバナーを表示中のケースをカバーする。
      await swrMutate(ACTIVE_BANK_TRANSFER_KEY);

      if (result.redirectUrl) {
        if (!isSafeRelativeRedirect(result.redirectUrl)) {
          showToast("リダイレクト URL が不正です。", "error");
          return;
        }
        window.location.href = result.redirectUrl;
        return;
      }
      showToast("申告を受け付けました", "success");
      onOpenChange(false);
    } catch (e) {
      // catch 内で握りつぶす（useAsyncAction の finally でロック解除されリトライ可能）
      showToast(err(e, "申告に失敗しました"), "error");
    }
  });

  // 送信中の close 操作は無視（二重送信や中断による不整合を防ぐ）
  const handleOpenChange = (next: boolean) => {
    if (isSubmitting) return;
    onOpenChange(next);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="振込完了の申告"
      maxWidth={520}
      className="p-4 gap-4"
      showCloseButton={!isSubmitting}
    >
      <Stack space={3}>
        {/* 添付画像プレビュー */}
        <Stack space={1}>
          <Span size="xs" tone="muted">
            添付した画像
          </Span>
          <Block className="overflow-hidden rounded-md border border-border bg-muted/30">
            {/*
              縦長画像（ネットバンキングのスクショ等）でモーダルが伸び過ぎないよう
              max-h-44 (176px) で頭打ち。object-contain でアスペクト比は維持し、
              余白は bg-muted で埋める。
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proofImageUrl}
              alt="振込明細"
              className="mx-auto max-h-44 w-full bg-muted object-contain"
            />
          </Block>
        </Stack>

        {/* お手続きに関するご注意 */}
        <Block padding="sm" className="rounded-lg border-2 border-destructive/40 bg-destructive/5">
          <Stack space={2}>
            <Flex gap="xs" align="center">
              <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-destructive" />
              <Span weight="semiBold" size="sm" tone="destructive">
                お手続きに関するご注意
              </Span>
            </Flex>
            <Stack space={2}>
              <Para size="xs" className="leading-snug">
                実際にお振込みが完了した場合のみ申告してください。
              </Para>
              <Para size="xs" className="leading-snug">
                お振り込みや画像に不備などがあった場合、ご入金の確認が取れるまで景品の発送等が保留になる可能性がございます。
              </Para>
              <Para size="xs" className="leading-snug">
                振込人名末尾の数字が付与されていることご確認ください。
              </Para>
            </Stack>
          </Stack>
        </Block>

        {/*
          同意チェックボックス（チェック必須）。
          - py-2: 上下に余白を持たせて注意書きとボタンから離す
          - name 指定: BooleanCheckboxInput が <Label htmlFor> を貼るのに使われるため、
            これがないとラベルクリックでチェックが切り替わらない
        */}
        <Flex justify="center" className="py-2">
          <BooleanCheckboxInput
            name="agree-bank-transfer-confirm"
            value={agreed}
            // BooleanCheckboxInput の onChange 型が (boolean | FormEvent) の intersection に
            // なっているため型ガード経由で boolean のみを取り出す
            onChange={(v) => {
              if (typeof v === "boolean") setAgreed(v);
            }}
            disabled={isSubmitting}
            label={<Span size="sm">上記にすべて同意する</Span>}
          />
        </Flex>

        {/* フッターアクション */}
        <Flex justify="end" gap="sm" wrap="wrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => execute()}
            disabled={isSubmitting || !agreed}
          >
            {isSubmitting ? (
              <Flex align="center" gap="xs">
                <Spinner className="h-4 w-4" />
                <span>送信中...</span>
              </Flex>
            ) : (
              "この内容で申告する"
            )}
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
