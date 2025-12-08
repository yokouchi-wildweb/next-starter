// src/features/core/wallet/components/CoinPurchasePage/PurchasePackageSelector.tsx

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { SecTitle, Span } from "@/components/TextBlocks";

type PurchasePackage = {
  id: string;
  amount: number;
  price: number;
  label: string;
  bonus?: string;
};

type PurchasePackageSelectorProps = {
  packages: readonly PurchasePackage[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function PurchasePackageSelector({
  packages,
  selectedId,
  onSelect,
}: PurchasePackageSelectorProps) {
  return (
    <Section space="sm">
      <SecTitle as="h2" size="lg">
        購入コイン数を選択
      </SecTitle>
      <Block space="sm">
        {packages.map((pkg) => (
          <label
            key={pkg.id}
            className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <Flex align="center" gap="sm">
              <input
                type="radio"
                name="purchasePackage"
                value={pkg.id}
                checked={selectedId === pkg.id}
                onChange={() => onSelect(pkg.id)}
                className="size-5 accent-primary"
              />
              <Flex direction="column" gap="none">
                <Span weight="medium" className="text-coin">
                  {pkg.label}
                </Span>
                {pkg.bonus && (
                  <Span size="sm" tone="success">
                    {pkg.bonus}
                  </Span>
                )}
              </Flex>
            </Flex>
            <Span weight="bold">¥{pkg.price.toLocaleString()}</Span>
          </label>
        ))}
      </Block>
    </Section>
  );
}
