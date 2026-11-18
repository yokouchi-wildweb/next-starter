// src/features/core/purchaseRequest/components/DummyPaymentForm/index.tsx

"use client";

import { useSearchParams } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";

import { useDummyPayment } from "@/features/core/purchaseRequest/hooks/useDummyPayment";

export function DummyPaymentForm() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const successUrl = searchParams.get("success_url");
  const cancelUrl = searchParams.get("cancel_url");
  const amount = searchParams.get("amount");
  const paymentMethod = searchParams.get("payment_method");

  const { pay, loading, error } = useDummyPayment({ sessionId, successUrl, cancelUrl, paymentMethod });

  // パラメータ不足チェック
  if (!sessionId || !successUrl || !cancelUrl) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        className="min-h-screen bg-muted"
      >
        <Block appearance="surface" padding={{ base: "md", sm: "lg" }} className="max-w-md rounded-lg">
          <Para tone="destructive" align="center">
            必要なパラメータが不足しています。
          </Para>
          <Para tone="muted" size="sm" align="center">
            session_id, success_url, cancel_url が必要です。
          </Para>
        </Block>
      </Flex>
    );
  }

  const handlePayment = (success: boolean) => {
    void pay(success);
  };

  const handleCancel = () => {
    window.location.href = cancelUrl;
  };

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      className="min-h-screen bg-muted"
    >
      <Block appearance="surface" padding={{ base: "md", sm: "lg" }} className="w-full max-w-md rounded-lg">
        <Flex direction="column" gap="lg">
          {/* ヘッダー */}
          <Flex direction="column" align="center" gap="md">
            <CreditCard className="h-12 w-12 text-info-text" />
            <Para size="lg" weight="bold" align="center">
              ダミー決済ページ
            </Para>
            <Para tone="muted" size="sm" align="center">
              開発・テスト用の決済シミュレーション
            </Para>
          </Flex>

          {/* 決済情報 */}
          <Block appearance="soft" padding={{ base: "sm", sm: "md" }} className="rounded-md">
            <Flex direction="column" gap="xs">
              <Flex justify="between">
                <Para tone="muted" size="sm">
                  セッションID
                </Para>
                <Para size="sm" className="font-mono text-xs">
                  {sessionId.slice(0, 8)}...
                </Para>
              </Flex>
              {amount && (
                <Flex justify="between">
                  <Para tone="muted" size="sm">
                    お支払い金額
                  </Para>
                  <Para size="sm" weight="bold">
                    {Number(amount).toLocaleString()} 円
                  </Para>
                </Flex>
              )}
              {paymentMethod && (
                <Flex justify="between">
                  <Para tone="muted" size="sm">
                    支払い方法
                  </Para>
                  <Para size="sm" className="font-mono text-xs">
                    {paymentMethod}
                  </Para>
                </Flex>
              )}
            </Flex>
          </Block>

          {/* エラー表示 */}
          {error && (
            <Para tone="destructive" size="sm" align="center">
              {error}
            </Para>
          )}

          {/* ボタン */}
          <Flex direction="column" gap="md">
            <Button
              onClick={() => handlePayment(true)}
              loading={loading}
              loadingLabel="処理中..."
              variant="default"
              className="w-full"
            >
              決済を完了する
            </Button>

            <Button
              onClick={() => handlePayment(false)}
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              決済を失敗させる
            </Button>

            <Button
              onClick={handleCancel}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              キャンセル
            </Button>
          </Flex>

          {/* 説明 */}
          <Para tone="muted" size="sm" align="center">
            これはテスト用の画面です。本番環境では外部決済サービスの画面が表示されます。
          </Para>
        </Flex>
      </Block>
    </Flex>
  );
}
