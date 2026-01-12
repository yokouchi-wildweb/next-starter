// src/features/core/wallet/components/WalletBalancePage/index.tsx

"use client";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useWalletBalances } from "@/features/core/wallet/hooks/useWalletBalances";
import { getCurrencyConfigBySlug } from "@/features/core/wallet/utils/currency";

import { BalanceCard } from "./BalanceCard";
import { PurchaseList } from "./PurchaseList";

type WalletBalancePageProps = {
  /** URLスラッグ */
  slug: string;
};

export function WalletBalancePage({ slug }: WalletBalancePageProps) {
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
    <Block space="md">
      <Flex justify="end">
        <LinkButton href={`/wallet/${slug}/history`} variant="outline" size="sm">
          履歴
        </LinkButton>
      </Flex>
      <BalanceCard balance={currentBalance} config={config} />
      <PurchaseList slug={slug} config={config} />
    </Block>
  );
}
