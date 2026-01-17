// src/features/core/wallet/components/WalletPurchasePage/index.tsx

"use client";

import { useSearchParams } from "next/navigation";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useWalletBalances } from "@/features/core/wallet/hooks/useWalletBalances";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";
import { CurrencyPurchase } from "./CurrencyPurchase";

type WalletPurchasePageProps = {
  /** URLスラッグ */
  slug: string;
};

export function WalletPurchasePage({ slug }: WalletPurchasePageProps) {
  const searchParams = useSearchParams();
  const amountParam = searchParams.get("amount");
  const priceParam = searchParams.get("price");

  const config = getCurrencyConfigBySlug(slug);
  const { user } = useAuthSession();
  const { data, isLoading, error } = useWalletBalances(user?.userId);

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

  const backUrl = `/wallet/${slug}`;

  // パラメータ不足チェック
  if (!amountParam || !priceParam) {
    return (
      <Stack space={8}>
        <Para tone="danger" align="center">
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
        <Para tone="danger" align="center">
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
        <Para tone="danger" align="center">
          残高情報の取得に失敗しました。
        </Para>
      </Block>
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
      <CurrencyPurchase
        purchaseAmount={purchaseAmount}
        paymentAmount={paymentAmount}
        currentBalance={currentBalance}
        walletType={config.walletType}
      />
    </Stack>
  );
}
