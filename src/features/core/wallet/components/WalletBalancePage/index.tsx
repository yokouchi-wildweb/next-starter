// src/features/core/wallet/components/WalletBalancePage/index.tsx

"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useWalletBalances } from "@/features/core/wallet/hooks/useWalletBalances";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { saveCouponCode } from "@/features/core/wallet/utils/couponParam";

import { BalanceCard } from "./BalanceCard";
import { PurchaseList } from "./PurchaseList";
import { PhoneVerificationRequired } from "./PhoneVerificationRequired";

type WalletBalancePageProps = {
  /** URLスラッグ */
  slug: string;
  /** 電話番号認証日時（認証済みの場合） */
  phoneVerifiedAt?: Date | null;
  /** 現在の電話番号 */
  currentPhoneNumber?: string | null;
};

export function WalletBalancePage({
  slug,
  phoneVerifiedAt,
  currentPhoneNumber,
}: WalletBalancePageProps) {
  const searchParams = useSearchParams();
  const config = getCurrencyConfigBySlug(slug);
  const { user } = useAuthSession();
  const { data, isLoading, error } = useWalletBalances(user?.userId);

  // URLパラメータ ?coupon=CODE をsessionStorageに保存
  useEffect(() => {
    const coupon = searchParams.get("coupon");
    if (coupon) {
      saveCouponCode(coupon);
    }
  }, [searchParams]);

  // 無効なスラッグ
  if (!config) {
    return (
      <Block padding="lg">
        <Para tone="danger" align="center">
          無効な通貨タイプです。
        </Para>
      </Block>
    );
  }

  // ローディング中
  if (isLoading) {
    return (
      <Flex justify="center" padding="lg">
        <Spinner className="h-8 w-8" />
      </Flex>
    );
  }

  // エラー
  if (error) {
    return (
      <Block padding="lg">
        <Para tone="danger" align="center">
          残高情報の取得に失敗しました。
        </Para>
      </Block>
    );
  }

  // 該当ウォレットの残高を取得
  const wallet = data?.wallets.find((w) => w.type === config.walletType);
  const currentBalance = wallet?.balance ?? 0;

  // 購入制限チェック: SMS認証が必要かどうか
  const requiresPhoneVerification =
    APP_FEATURES.wallet.purchaseRestriction === "phoneVerified" && !phoneVerifiedAt;

  return (
    <Stack space={6}>
      <Flex justify="end">
        <LinkButton href={`/wallet/${slug}/history`} variant="outline" size="sm">
          履歴
        </LinkButton>
      </Flex>
      <BalanceCard balance={currentBalance} config={config} />
      {requiresPhoneVerification ? (
        <PhoneVerificationRequired currentPhoneNumber={currentPhoneNumber} />
      ) : (
        <PurchaseList slug={slug} config={config} />
      )}
    </Stack>
  );
}
