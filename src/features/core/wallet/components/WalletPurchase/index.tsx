// src/features/core/wallet/components/WalletPurchase/index.tsx
// セクションコンテナ(購入・決済方法選択)。
// 下流が複製したら部品の import は入口へ向ける(CLAUDE.md core_ui)

"use client";

import { useSearchParams } from "next/navigation";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useMyWalletBalances } from "@/features/core/wallet/hooks/useMyWalletBalances";
import { isPurchaseSuspended, getPurchaseSuspensionMessage } from "@/features/core/wallet/utils/purchaseSuspension";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { ActiveTransferBanner } from "@/features/core/bankTransferReview/components/ActiveTransferBanner";

import { PurchaseSuspended } from "@/features/core/wallet/components/common/PurchaseSuspended";
import { CurrencyPurchase } from "@/features/core/wallet/components/WalletPurchase/CurrencyPurchase";

// 部品の barrel export: 下流が Screen やセクションコンテナを複製するときはここから import する
export { CurrencyPurchase };

export type WalletPurchaseProps = {
  /** URLスラッグ */
  slug: string;
};

export { CouponInput } from "./CouponInput";

export function WalletPurchase({ slug }: WalletPurchaseProps) {
  const searchParams = useSearchParams();
  const amountParam = searchParams.get("amount");
  const priceParam = searchParams.get("price");

  const config = getCurrencyConfigBySlug(slug);
  const { user } = useAuthSession();
  const { data, isLoading, error } = useMyWalletBalances(user?.userId);

  // 無効なスラッグ
  if (!config) {
    return (
      <Block padding="lg">
        <Para tone="destructive" align="center">
          無効な通貨タイプです。
        </Para>
      </Block>
    );
  }

  const backUrl = `/wallet/${slug}`;

  // パラメータ不足チェック
  if (!amountParam || !priceParam) {
    return (
      <Stack space={8}>
        <Para tone="destructive" align="center">
          購入情報が指定されていません。
        </Para>
        <Flex justify="center">
          <LinkButton href={backUrl} variant="outline">
            {config.label}管理へ戻る
          </LinkButton>
        </Flex>
      </Stack>
    );
  }

  const purchaseAmount = Number(amountParam);
  const paymentAmount = Number(priceParam);

  // 数値バリデーション
  if (isNaN(purchaseAmount) || isNaN(paymentAmount) || purchaseAmount <= 0 || paymentAmount <= 0) {
    return (
      <Stack space={8}>
        <Para tone="destructive" align="center">
          無効な購入情報です。
        </Para>
        <Flex justify="center">
          <LinkButton href={backUrl} variant="outline">
            {config.label}管理へ戻る
          </LinkButton>
        </Flex>
      </Stack>
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
        <Para tone="destructive" align="center">
          残高情報の取得に失敗しました。
        </Para>
      </Block>
    );
  }

  // 購入一時停止チェック
  if (isPurchaseSuspended()) {
    return (
      <Stack space={6}>
        <Flex justify="end">
          <LinkButton href={backUrl} variant="outline" size="sm">
            {config.label}管理に戻る
          </LinkButton>
        </Flex>
        {/* 進行中の自社銀行振込バナー（active が null なら自動的に非描画） */}
        <ActiveTransferBanner />
        <PurchaseSuspended message={getPurchaseSuspensionMessage()} />
      </Stack>
    );
  }

  // 該当ウォレットの残高を取得
  const wallet = data?.wallets.find((w) => w.type === config.walletType);
  const currentBalance = wallet?.balance ?? 0;

  return (
    <Stack space={6}>
      <Flex justify="end">
        <LinkButton href={backUrl} variant="outline" size="sm">
          {config.label}管理に戻る
        </LinkButton>
      </Flex>
      {/* 進行中の自社銀行振込バナー（active が null なら自動的に非描画） */}
      <ActiveTransferBanner />
      <CurrencyPurchase
        purchaseAmount={purchaseAmount}
        paymentAmount={paymentAmount}
        currentBalance={currentBalance}
        walletType={config.walletType}
      />
    </Stack>
  );
}
