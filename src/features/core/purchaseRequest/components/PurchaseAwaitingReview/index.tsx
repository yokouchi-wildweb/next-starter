// src/features/core/purchaseRequest/components/PurchaseAwaitingReview/index.tsx
//
// 銀行振込の申告後、通貨が未付与のまま運営の確認を待っている状態の案内画面。
// 以下の両ケースで confirm API の redirectUrl からここに誘導される:
//   - mode=approval_required の通常申告（管理者のレビュー待ち）
//   - AI 判定不承認のままの申告（needs_check / 運営による入金確認待ち）
// 申告済みであることと「確認後に付与される」ことを伝え、購入情報を再掲する。
// 万一通貨付与まで完了していた場合（リロードや古いリンクからの再訪）は完了画面へ誘導する。

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock } from "lucide-react";
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

type PurchaseAwaitingReviewProps = {
  /** URLスラッグ */
  slug: string;
};

export function PurchaseAwaitingReview({ slug }: PurchaseAwaitingReviewProps) {
  const currencyConfig = getCurrencyConfigBySlug(slug);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request_id");

  const [purchaseInfo, setPurchaseInfo] = useState<PurchaseStatusResponse | null>(null);
  // requestId 無しは取得を試みないため、初期 loading も false から始める
  const [loading, setLoading] = useState(requestId !== null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // requestId 欠落は state ではなく描画時に導出する（effect 内での同期 setState を避ける）
  const error = !requestId ? "リクエストIDが指定されていません。" : fetchError;

  useEffect(() => {
    if (!requestId) return;

    const fetchStatus = async () => {
      try {
        const status = await getPurchaseStatus(requestId);
        // 既に付与済み（確認が完了した後の再訪等）なら完了画面に差し替える。
        // この場合 loading は true のままにして遷移までスピナーを出し続ける。
        if (status.status === "completed") {
          router.replace(`/wallet/${slug}/purchase/complete?request_id=${requestId}`);
          return;
        }
        setPurchaseInfo(status);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch purchase status:", err);
        setFetchError("購入情報の取得に失敗しました。");
        setLoading(false);
      }
    };

    fetchStatus();
  }, [requestId, router, slug]);

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
        <Clock className="h-16 w-16 text-warning" />

        <Para align="center" size="lg" weight="bold">
          振込完了の申告を受け付けました
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

        <Para align="center" tone="muted" size="sm">
          運営にてご入金の確認が完了すると、
          {currencyConfig?.label ?? "通貨"}が付与されます。
          <br />
          確認にはお時間をいただく場合がございます。
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
