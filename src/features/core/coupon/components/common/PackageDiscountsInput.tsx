// パッケージ別割引設定の入力コンポーネント
//
// クーポンの discountMode が "per_package" の場合に表示する。
// currency.config.ts のパッケージ一覧を元に、各パッケージの割引タイプ・割引値を入力する。

"use client";

import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import { Span } from "@/components/TextBlocks";
import { NumberInput } from "@/components/Form/Input/Manual";
import { CURRENCY_CONFIG } from "@/config/app/currency.config";
import type { PackageDiscount } from "@/features/core/purchaseRequest/types/couponEffect";

/**
 * settings.packageDiscounts の入力UI
 *
 * 全通貨のパッケージを統合して表示し、各パッケージに割引タイプと割引値を設定する。
 * discountMode が "per_package" のときのみ表示される想定。
 */
export function PackageDiscountsInput() {
  const { watch, setValue } = useFormContext();

  const discountMode = watch("settings.discountMode");
  const packageDiscounts = (watch("settings.packageDiscounts") ?? []) as PackageDiscount[];

  // 全通貨のパッケージを統合（重複 amount は除外）
  const allPackages = getAllPackages();

  // discountMode が per_package に切り替わった際に初期値を設定
  useEffect(() => {
    if (discountMode !== "per_package") return;
    if (packageDiscounts.length > 0) return;

    const initial: PackageDiscount[] = allPackages.map((pkg) => ({
      amount: pkg.amount,
      discountType: "percentage",
      discountValue: 0,
    }));
    setValue("settings.packageDiscounts", initial, { shouldDirty: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountMode]);

  if (discountMode !== "per_package") return null;

  const handleValueChange = (index: number, value: number) => {
    const updated = [...packageDiscounts];
    updated[index] = { ...updated[index], discountValue: value };
    setValue("settings.packageDiscounts", updated, { shouldDirty: true });
  };

  const handleTypeChange = (index: number, type: "fixed" | "percentage") => {
    const updated = [...packageDiscounts];
    updated[index] = { ...updated[index], discountType: type };
    setValue("settings.packageDiscounts", updated, { shouldDirty: true });
  };

  return (
    <Block className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <Stack space={3}>
        <Span size="sm" weight="bold">パッケージ別割引設定</Span>
        <Stack space={2}>
          {allPackages.map((pkg, index) => {
            const entry = packageDiscounts[index];
            if (!entry) return null;

            return (
              <Flex
                key={pkg.amount}
                align="center"
                gap="sm"
                className="rounded-md bg-white px-3 py-2"
              >
                <Span size="sm" className="min-w-20 shrink-0">
                  {pkg.amount.toLocaleString()} {pkg.unit}
                </Span>
                <select
                  value={entry.discountType}
                  onChange={(e) => handleTypeChange(index, e.target.value as "fixed" | "percentage")}
                  className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
                >
                  <option value="percentage">%割引</option>
                  <option value="fixed">円割引</option>
                </select>
                <NumberInput
                  value={entry.discountValue}
                  onChange={(v) => handleValueChange(index, v)}
                  min={0}
                  placeholder={entry.discountType === "percentage" ? "%" : "円"}
                  className="w-24"
                />
              </Flex>
            );
          })}
        </Stack>
      </Stack>
    </Block>
  );
}

// ============================================================================
// ヘルパー
// ============================================================================

function getAllPackages(): { amount: number; unit: string }[] {
  const seen = new Set<number>();
  const result: { amount: number; unit: string }[] = [];

  for (const config of Object.values(CURRENCY_CONFIG)) {
    for (const pkg of config.packages) {
      if (!seen.has(pkg.amount)) {
        seen.add(pkg.amount);
        result.push({ amount: pkg.amount, unit: config.unit });
      }
    }
  }

  return result.sort((a, b) => a.amount - b.amount);
}
