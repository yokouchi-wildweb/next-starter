// src/features/core/wallet/components/WalletIndexPage/index.tsx

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";

export function WalletIndexPage() {
  const walletTypes = Object.keys(CURRENCY_CONFIG) as WalletType[];

  return (
    <Stack space={0}>
      {walletTypes.map((walletType) => {
        const config = CURRENCY_CONFIG[walletType];
        const Icon = config.icon;

        return (
          <Link
            key={walletType}
            href={`/wallet/${config.slug}`}
            className="block border-b border-gray-100 last:border-b-0"
          >
            <Flex
              justify="between"
              align="center"
              padding="md"
              className="transition-colors hover:bg-gray-50"
            >
              <Flex align="center" gap="sm">
                <Icon
                  className="size-6"
                  style={{ color: config.color }}
                />
                <Span size="md" weight="medium">
                  {config.label}
                </Span>
              </Flex>
              <ChevronRight className="size-5 text-gray-400" />
            </Flex>
          </Link>
        );
      })}
    </Stack>
  );
}
