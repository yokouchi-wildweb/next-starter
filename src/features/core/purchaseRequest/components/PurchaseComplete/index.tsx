// src/features/core/purchaseRequest/components/PurchaseComplete/index.tsx
// セクションコンテナ(購入完了)。HTTP は usePurchaseStatus 経由(client service を直接呼ばない)

"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { usePurchaseStatus } from "@/features/core/purchaseRequest/hooks/usePurchaseStatus";
import { CurrencyDisplay, getCurrencyConfigBySlug } from "@/features/core/wallet";
import { useGoogleAdsConversion } from "@/lib/googleTag";
import { MilestoneNotifications } from "@/features/core/milestone/components/MilestoneNotifications";
import type { PersistedMilestoneResult } from "@/features/core/milestone/types/milestone";

export type PurchaseCompleteProps = {
  /** URLスラッグ */
  slug: string;
};

export function PurchaseComplete({ slug }: PurchaseCompleteProps) {
  const currencyConfig = getCurrencyConfigBySlug(slug);
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request_id");

  const { data: purchaseInfo, error: fetchError, isLoading } = usePurchaseStatus(requestId);
  // requestId 欠落は描画時に導出する(取得は行わない)
  const error = !requestId
    ? "リクエストIDが指定されていません。"
    : fetchError
      ? "購入情報の取得に失敗しました。"
      : null;
  const loading = requestId !== null && isLoading;

  // コイン購入完了コンバージョン（status==="completed" 時のみ・transaction_id で dedup。env 未設定なら no-op）
  const { fire } = useGoogleAdsConversion();
  useEffect(() => {
    if (!requestId) return;
    if (purchaseInfo?.status !== "completed") return;
    fire("coinPurchase", {
      value: purchaseInfo.paymentAmount,
      currency: "JPY",
      transactionId: requestId,
    });
  }, [purchaseInfo, requestId, fire]);

  if (loading) {
    return (
      <Flex justify="center" padding="lg">
        <Spinner className="h-8 w-8" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Stack space={8}>
        <Para tone="destructive" align="center">
          {error}
        </Para>
        <Flex justify="center">
          <LinkButton href={`/wallet/${slug}`} variant="outline">
            {currencyConfig?.label ?? "ウォレット"}管理ページへ戻る
          </LinkButton>
        </Flex>
      </Stack>
    );
  }

  return (
    <Stack space={8}>
      <Flex direction="column" align="center" gap="md">
        <CheckCircle className="h-16 w-16 text-success-text" />

        <Para align="center" size="lg" weight="bold">
          購入が完了しました
        </Para>

        {purchaseInfo && (
          <Stack appearance="surface" padding="md" space={4} className="rounded-lg">
            <Flex direction="column" gap="xs">
              <Flex justify="between" gap="md" align="center">
                <Para tone="muted" size="sm">購入数量</Para>
                {currencyConfig && (
                  <CurrencyDisplay
                    walletType={currencyConfig.walletType}
                    amount={purchaseInfo.amount}
                    size="sm"
                    showUnit
                    bold
                  />
                )}
              </Flex>
              <Flex justify="between" gap="md">
                <Para tone="muted" size="sm">お支払い金額</Para>
                <Para size="sm" weight="bold">
                  {purchaseInfo.paymentAmount.toLocaleString()} 円
                </Para>
              </Flex>
            </Flex>
          </Stack>
        )}

        {purchaseInfo?.milestoneResults && (purchaseInfo.milestoneResults as PersistedMilestoneResult[]).length > 0 && (
          <MilestoneNotifications results={purchaseInfo.milestoneResults as PersistedMilestoneResult[]} />
        )}

        <Para align="center" tone="muted" size="sm">
          ご購入いただきありがとうございます。
        </Para>

        <Flex justify="center">
          <LinkButton href={`/wallet/${slug}`} variant="default">
            {currencyConfig?.label ?? "ウォレット"}管理へ戻る
          </LinkButton>
        </Flex>
      </Flex>
    </Stack>
  );
}
