// src/features/core/purchaseRequest/components/PurchaseComplete/index.tsx

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import {
  getPurchaseStatus,
  type PurchaseStatusResponse,
} from "../../services/client/purchaseRequestClient";
import { CurrencyDisplay, getCurrencyConfigBySlug } from "@/features/core/wallet";
import { MilestoneNotifications } from "@/features/core/milestone/components/MilestoneNotifications";
import type { PersistedMilestoneResult } from "@/features/core/milestone/types/milestone";

type PurchaseCompleteProps = {
  /** URLスラッグ */
  slug: string;
};

export function PurchaseComplete({ slug }: PurchaseCompleteProps) {
  const currencyConfig = getCurrencyConfigBySlug(slug);
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
      <Stack space={8}>
        <Para tone="danger" align="center">
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
        <CheckCircle className="h-16 w-16 text-green-500" />

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
