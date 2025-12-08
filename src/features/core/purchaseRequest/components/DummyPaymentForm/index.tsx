// src/features/core/purchaseRequest/components/DummyPaymentForm/index.tsx

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { CreditCard } from "lucide-react";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";
import { Spinner } from "@/components/Overlays/Loading/Spinner";

export function DummyPaymentForm() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const successUrl = searchParams.get("success_url");
  const cancelUrl = searchParams.get("cancel_url");
  const amount = searchParams.get("amount");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // パラメータ不足チェック
  if (!sessionId || !successUrl || !cancelUrl) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        className="min-h-screen bg-gray-100"
      >
        <Block appearance="surface" padding="lg" className="max-w-md rounded-lg">
          <Para tone="danger" align="center">
            必要なパラメータが不足しています。
          </Para>
          <Para tone="muted" size="sm" align="center">
            session_id, success_url, cancel_url が必要です。
          </Para>
        </Block>
      </Flex>
    );
  }

  const handlePayment = async (success: boolean) => {
    setLoading(true);
    setError(null);

    try {
      // Webhookを呼び出して決済結果を通知
      await axios.post("/api/webhook/payment?provider=dummy", {
        event_type: success ? "payment.completed" : "payment.failed",
        session_id: sessionId,
      });

      // 成功または失敗のURLへリダイレクト
      if (success) {
        window.location.href = successUrl;
      } else {
        window.location.href = `${cancelUrl}&error_code=PAYMENT_FAILED`;
      }
    } catch (err) {
      console.error("Payment webhook call failed:", err);
      setError("決済処理中にエラーが発生しました。");
      setLoading(false);
    }
  };

  const handleCancel = () => {
    window.location.href = cancelUrl;
  };

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      className="min-h-screen bg-gray-100"
    >
      <Block appearance="surface" padding="lg" className="w-full max-w-md rounded-lg">
        <Flex direction="column" gap="md">
          {/* ヘッダー */}
          <Flex direction="column" align="center" gap="sm">
            <CreditCard className="h-12 w-12 text-blue-600" />
            <Para size="lg" weight="bold" align="center">
              ダミー決済ページ
            </Para>
            <Para tone="muted" size="sm" align="center">
              開発・テスト用の決済シミュレーション
            </Para>
          </Flex>

          {/* 決済情報 */}
          <Block appearance="soft" padding="md" className="rounded-md">
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
            </Flex>
          </Block>

          {/* エラー表示 */}
          {error && (
            <Para tone="danger" size="sm" align="center">
              {error}
            </Para>
          )}

          {/* ボタン */}
          <Flex direction="column" gap="sm">
            <Button
              onClick={() => handlePayment(true)}
              disabled={loading}
              variant="default"
              className="w-full"
            >
              {loading ? (
                <Flex align="center" gap="xs">
                  <Spinner className="h-4 w-4" />
                  <span>処理中...</span>
                </Flex>
              ) : (
                "決済を完了する"
              )}
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
