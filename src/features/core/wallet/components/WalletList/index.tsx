// src/features/core/wallet/components/WalletList/index.tsx
// セクションコンテナ(ウォレット一覧)

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { getCurrencyIcon } from "@/features/core/wallet/components/common/currencyIcons";
import type { WalletIndexEntry } from "@/features/core/wallet/types/screen";

export type WalletListProps = {
  /** 表示する通貨の一覧(loadWalletIndexScreen の wallets)。省略時は通貨設定の全件を設定順に表示 */
  wallets?: WalletIndexEntry[];
};

function listAllWallets(): WalletIndexEntry[] {
  return (Object.keys(CURRENCY_CONFIG) as WalletType[]).map((walletType) => ({
    walletType,
    slug: CURRENCY_CONFIG[walletType].slug,
    label: CURRENCY_CONFIG[walletType].label,
  }));
}

export function WalletList({ wallets }: WalletListProps) {
  const entries = wallets ?? listAllWallets();

  return (
    <Stack space={0}>
      {entries.map((entry) => {
        const config = CURRENCY_CONFIG[entry.walletType];
        const Icon = getCurrencyIcon(entry.walletType);

        return (
          <Link
            key={entry.walletType}
            href={`/wallet/${entry.slug}`}
            className="block border-b border-border last:border-b-0"
          >
            <Flex
              justify="between"
              align="center"
              padding="md"
              className="transition-colors hover:bg-muted/50"
            >
              <Flex align="center" gap="sm">
                <Icon
                  className="size-6"
                  style={{ color: config.color }}
                />
                <Span size="md" weight="medium">
                  {entry.label}
                </Span>
              </Flex>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Flex>
          </Link>
        );
      })}
    </Stack>
  );
}
