// src/features/core/purchaseRequest/components/PurchaseFailed/index.tsx

"use client";

import { useSearchParams } from "next/navigation";
import { XCircle } from "lucide-react";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { LinkButton } from "@/components/Form/Button/LinkButton";

/**
 * エラー理由からユーザー向けメッセージを生成
 */
function getErrorMessage(reason: string | null, errorCode: string | null): string {
  if (reason === "cancelled") {
    return "決済がキャンセルされました。";
  }

  if (reason === "timeout") {
    return "決済結果の確認がタイムアウトしました。しばらく経ってから残高をご確認ください。";
  }

  if (reason === "expired") {
    return "購入リクエストの有効期限が切れました。";
  }

  if (errorCode) {
    switch (errorCode) {
      case "PAYMENT_FAILED":
        return "決済処理に失敗しました。";
      case "CARD_DECLINED":
        return "カードが拒否されました。別のお支払い方法をお試しください。";
      case "INSUFFICIENT_FUNDS":
        return "残高不足です。";
      default:
        return `決済エラーが発生しました（${errorCode}）`;
    }
  }

  return "購入処理中にエラーが発生しました。";
}

export function PurchaseFailed() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request_id");
  const reason = searchParams.get("reason");
  const errorCode = searchParams.get("error_code");

  const errorMessage = getErrorMessage(reason, errorCode);

  return (
    <Block space="lg">
      <Flex direction="column" align="center" gap="md">
        <XCircle className="h-16 w-16 text-red-500" />

        <Para align="center" size="lg" weight="bold">
          購入に失敗しました
        </Para>

        <Para align="center" tone="muted">
          {errorMessage}
        </Para>

        {requestId && (
          <Para align="center" tone="muted" size="sm">
            リクエストID: {requestId}
          </Para>
        )}

        <Flex gap="sm" wrap="wrap" justify="center">
          <LinkButton href="/coins/purchase" variant="default">
            もう一度購入する
          </LinkButton>
          <LinkButton href="/coins" variant="outline">
            コイン管理へ戻る
          </LinkButton>
        </Flex>
      </Flex>
    </Block>
  );
}
