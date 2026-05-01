// src/features/core/wallet/components/common/SupportedPaymentMethods/index.tsx
// payment.config.ts の paymentMethods をベースに、対応支払い方法の一覧をカード表示する。
// 表示対象は status が "available" / "coming_soon" のもの（disabled は除外）。

import { CreditCard, Landmark, ShoppingCart, Smartphone, Store, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks";
import {
  getVisiblePaymentMethods,
  type PaymentMethodConfig,
  type PaymentMethodStatus,
} from "@/config/app/payment.config";

/**
 * payment.config.ts の icon 識別子 → Lucide アイコンへのマッピング
 *
 * [!!] payment.config.ts の paymentMethods に新しい icon を追加した場合はここも更新すること。
 * マッピング未登録の場合は汎用の Wallet アイコンにフォールバックする。
 */
const PAYMENT_ICON_MAP: Record<string, LucideIcon> = {
  "credit-card": CreditCard,
  store: Store,
  bank: Landmark,
  paypay: Smartphone,
  amazon: ShoppingCart,
};

function resolveIcon(iconId: string): LucideIcon {
  return PAYMENT_ICON_MAP[iconId] ?? Wallet;
}

function StatusBadge({ status }: { status: PaymentMethodStatus }) {
  const isAvailable = status === "available";
  return (
    <Span
      size="xs"
      className={
        isAvailable
          ? "rounded-full bg-success/15 px-2 py-0.5 text-success"
          : "rounded-full bg-warning/15 px-2 py-0.5 text-warning"
      }
    >
      {isAvailable ? "対応済み" : "準備中"}
    </Span>
  );
}

function PaymentMethodCard({ method }: { method: PaymentMethodConfig }) {
  const Icon = resolveIcon(method.icon);
  const isAvailable = method.status === "available";
  const cardClasses = isAvailable
    ? "rounded-lg border-2 border-success/40 bg-success/5"
    : "rounded-lg border-2 border-warning/40 bg-background";
  const accentClass = isAvailable ? "text-success" : "text-warning";
  // アイコン背景: 斜めグラデ + 細リング + 微弱シャドウで立体感を出す
  const iconContainerClass = isAvailable
    ? "shrink-0 rounded-xl bg-gradient-to-br from-success/30 via-success/15 to-success/5 shadow-sm ring-1 ring-inset ring-success/25"
    : "shrink-0 rounded-xl bg-gradient-to-br from-warning/30 via-warning/15 to-warning/5 shadow-sm ring-1 ring-inset ring-warning/25";

  return (
    <Block className={cardClasses} padding="md">
      <Flex align="start" gap="sm">
        <Flex
          align="center"
          justify="center"
          padding="sm"
          className={iconContainerClass}
        >
          <Icon aria-hidden className={`h-6 w-6 ${accentClass}`} strokeWidth={1.75} />
        </Flex>
        <Stack space={1} className="min-w-0 flex-1">
          <Flex justify="between" align="start">
            <Span weight="medium" size="sm">
              {method.label}
            </Span>
            <StatusBadge status={method.status} />
          </Flex>
          {method.description && (
            <Span size="xs" tone="muted">
              {method.description}
            </Span>
          )}
          <Flex justify="end">
            <Span size="xs" className={accentClass}>
              {isAvailable ? "ご利用いただけます" : "近日中に対応予定です"}
            </Span>
          </Flex>
        </Stack>
      </Flex>
    </Block>
  );
}

/**
 * 対応している支払い方法一覧
 *
 * payment.config.ts の paymentMethods をそのまま表示する。
 * 表示順・ラベル・補足説明（対応ブランド等）・ステータスは全て config 側で制御可能。
 */
export function SupportedPaymentMethods() {
  const methods = getVisiblePaymentMethods();

  if (methods.length === 0) {
    return null;
  }

  return (
    <Stack space={3}>
      <Span weight="medium" size="sm">
        ご利用いただける支払い方法
      </Span>
      <Stack space={2}>
        {methods.map((method) => (
          <PaymentMethodCard key={method.id} method={method} />
        ))}
      </Stack>
    </Stack>
  );
}
