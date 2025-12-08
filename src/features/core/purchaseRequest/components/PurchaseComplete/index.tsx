// src/features/core/purchaseRequest/components/PurchaseComplete/index.tsx

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import {
  getPurchaseStatus,
  type PurchaseStatusResponse,
} from "../../services/client/purchaseRequestClient";

export function PurchaseComplete() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request_id");

  const [purchaseInfo, setPurchaseInfo] = useState<PurchaseStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setError("リクエストIDが指定されていません。");
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const status = await getPurchaseStatus(requestId);
        setPurchaseInfo(status);
      } catch (err) {
        console.error("Failed to fetch purchase status:", err);
        setError("購入情報の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [requestId]);

  if (loading) {
    return (
      <Flex justify="center" padding="lg">
        <Spinner className="h-8 w-8" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Block space="lg">
        <Para tone="danger" align="center">
          {error}
        </Para>
        <Flex justify="center">
          <LinkButton href="/coins" variant="outline">
            コイン管理ページへ戻る
          </LinkButton>
        </Flex>
      </Block>
    );
  }

  return (
    <Block space="lg">
      <Flex direction="column" align="center" gap="md">
        <CheckCircle className="h-16 w-16 text-green-500" />

        <Para align="center" size="lg" weight="bold">
          購入が完了しました
        </Para>

        {purchaseInfo && (
          <Block appearance="surface" padding="md" space="sm" className="rounded-lg">
            <Flex direction="column" gap="xs">
              <Flex justify="between" gap="md">
                <Para tone="muted" size="sm">購入数量</Para>
                <Para size="sm" weight="bold">
                  {purchaseInfo.amount.toLocaleString()} コイン
                </Para>
              </Flex>
              <Flex justify="between" gap="md">
                <Para tone="muted" size="sm">お支払い金額</Para>
                <Para size="sm" weight="bold">
                  {purchaseInfo.paymentAmount.toLocaleString()} 円
                </Para>
              </Flex>
            </Flex>
          </Block>
        )}

        <Para align="center" tone="muted" size="sm">
          ご購入いただきありがとうございます。
        </Para>

        <Flex gap="sm" wrap="wrap" justify="center">
          <LinkButton href="/coins" variant="default">
            残高を確認する
          </LinkButton>
          <LinkButton href="/coins/purchase" variant="outline">
            続けて購入する
          </LinkButton>
        </Flex>
      </Flex>
    </Block>
  );
}
