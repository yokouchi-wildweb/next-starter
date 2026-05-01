// src/features/core/purchaseRequest/components/BankTransferInstructionPage/CancelTransferButton.tsx
//
// 振込案内ページの最下部に配置する「振込による購入をキャンセル」ボタン。
// クリックで Dialog を開き、確認後にサーバー側 cancelPurchase API を呼んで
// purchase_request を expired にし、決済方法選択画面（/wallet/[slug]/purchase?...）へ
// リダイレクトする。
//
// 注意:
// - 不可逆操作（既振込み済みの場合の事故防止）のため Dialog で必ず一度確認を挟む。
// - Dialog の onConfirm は Promise を返すと自動でロック + ローディング管理されるため、
//   二重送信ガードは Dialog 側に委ねている。
// - redirectUrl はサーバー側で組み立てたものを信頼する（Open Redirect 防御として
//   "/" 始まりの相対 URL であることだけ確認）。

"use client";

import { useState } from "react";
import { mutate as swrMutate } from "swr";

import { Dialog } from "@/components/Overlays/Dialog";
import { Flex } from "@/components/Layout/Flex";
import { Button } from "@/components/Form/Button/Button";
import { Para } from "@/components/TextBlocks";
import { Stack } from "@/components/Layout/Stack";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors/httpError";

import { cancelPurchase } from "@/features/core/purchaseRequest/services/client/purchaseRequestClient";

/** useActiveBankTransfer の SWR key と一致させる */
const ACTIVE_BANK_TRANSFER_KEY = "/api/wallet/purchase/bank-transfer/active";

/**
 * サーバーから受け取った redirectUrl が「同一オリジン内の相対 URL」かを検証する
 * （Open Redirect への defense-in-depth）。
 */
function isSafeRelativeRedirect(url: string): boolean {
  if (typeof url !== "string" || url === "") return false;
  return url.startsWith("/") && !url.startsWith("//");
}

type Props = {
  /** キャンセル対象の purchase_request の ID */
  requestId: string;
};

export function CancelTransferButton({ requestId }: Props) {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();

  const handleConfirm = async () => {
    try {
      const result = await cancelPurchase(requestId);

      // active 状態（pending_review / pre_submit）が消えるはずなのでキャッシュ無効化
      await swrMutate(ACTIVE_BANK_TRANSFER_KEY);

      if (result.redirectUrl && isSafeRelativeRedirect(result.redirectUrl)) {
        window.location.href = result.redirectUrl;
        return;
      }

      // フォールバック: redirectUrl 不正・空のときは現在のページをリロード。
      //   SSR の status ガード (Pattern B) が status=expired を検知して
      //   /wallet/[slug] へ自動でリダイレクトしてくれる。
      window.location.reload();
    } catch (e) {
      showToast(err(e, "キャンセル処理に失敗しました"), "error");
      throw e; // Dialog 側でロック解除させる（再試行を許可）
    }
  };

  return (
    <>
      <Flex justify="center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-destructive/40 text-destructive hover:bg-destructive/5"
          onClick={() => setOpen(true)}
        >
          振込による購入をキャンセル
        </Button>
      </Flex>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="振込による購入をキャンセルしますか？"
        confirmLabel="はい、キャンセルする"
        cancelLabel="戻る"
        confirmVariant="destructive"
        onConfirm={handleConfirm}
      >
        <Stack space={2}>
          <Para size="sm">
            進行中の振込手続きが無効になり、決済方法を選び直す画面に戻ります。
          </Para>
          <Para size="sm" tone="destructive">
            ※既にお振込みを完了されている場合は、キャンセルしないでください。お振込み済みの金額が反映されない可能性があります。
          </Para>
        </Stack>
      </Dialog>
    </>
  );
}
