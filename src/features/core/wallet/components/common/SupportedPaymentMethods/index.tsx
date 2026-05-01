// src/features/core/wallet/components/common/SupportedPaymentMethods/index.tsx
// payment.config.ts の paymentMethods をベースに、対応支払い方法を選択可能なカードリストとして表示する。
// 表示対象は status が "available" / "coming_soon" のもの（disabled は除外）。
//
// available: ラジオ的に選択可能（primary カラーで強調）
// coming_soon: 非アクティブ表示（"準備中" バッジ付き、選択不可）

"use client";

import { useState } from "react";
import { Check, CreditCard, Landmark, ShoppingCart, Smartphone, Store, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para, Span } from "@/components/TextBlocks";
import {
  getVisiblePaymentMethods,
  type PaymentMethodConfig,
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

function ComingSoonBadge() {
  return (
    <Span
      size="xs"
      className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-warning"
    >
      準備中
    </Span>
  );
}

function SelectionIndicator({ isSelected }: { isSelected: boolean }) {
  const containerClass = isSelected
    ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors"
    : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-card transition-colors";
  const checkOpacity = isSelected ? "opacity-100" : "opacity-0";

  return (
    <span aria-hidden className={containerClass}>
      <Check className={`h-3.5 w-3.5 transition-opacity ${checkOpacity}`} strokeWidth={3} />
    </span>
  );
}

type CardProps = {
  method: PaymentMethodConfig;
  isSelected: boolean;
  onSelect: () => void;
};

function PaymentMethodCard({ method, isSelected, onSelect }: CardProps) {
  const Icon = resolveIcon(method.icon);
  const isComingSoon = method.status === "coming_soon";

  // カード本体のクラス（状態別）
  // ※ 全状態で border-2 に統一して状態切替時の縦方向レイアウトシフトを防ぐ。
  //   選択時の強調はリング (ring-2) と border-color で表現する（ring は box-shadow 実装なのでレイアウトに影響しない）。
  // ※ 背景色は常に不透明な bg-card 系で保持し、半透明 tint (bg-primary/5 等) は使わない。
  //   半透明だと親要素が透けて選択時に見た目が抜けて見えるため。
  let cardClasses: string;
  if (isComingSoon) {
    cardClasses =
      "rounded-lg border-2 border-dashed border-warning/40 bg-background opacity-70";
  } else if (isSelected) {
    cardClasses =
      "rounded-lg border-2 border-primary bg-card ring-2 ring-primary/15 transition-all";
  } else {
    cardClasses =
      "rounded-lg border-2 border-border bg-card transition-all hover:border-primary/40";
  }

  // アイコンコンテナ（状態別: 斜めグラデ + 内側リング + 微弱シャドウ）
  let iconContainerClass: string;
  if (isComingSoon) {
    iconContainerClass =
      "shrink-0 rounded-xl bg-gradient-to-br from-warning/30 via-warning/15 to-warning/5 shadow-sm ring-1 ring-inset ring-warning/25";
  } else if (isSelected) {
    iconContainerClass =
      "shrink-0 rounded-xl bg-gradient-to-br from-primary/30 via-primary/15 to-primary/5 shadow-sm ring-1 ring-inset ring-primary/30 transition-colors";
  } else {
    iconContainerClass =
      "shrink-0 rounded-xl bg-gradient-to-br from-muted via-muted/50 to-muted/20 shadow-sm ring-1 ring-inset ring-border transition-colors";
  }

  // アイコン色
  const iconColorClass = isComingSoon
    ? "text-warning"
    : isSelected
      ? "text-primary"
      : "text-muted-foreground";

  // ラベル色 / 太さ
  const labelToneClass = isSelected ? "text-primary" : "";
  const labelWeight = isSelected ? "semiBold" : "medium";

  const innerContent = (
    <Flex align="center" gap="sm">
      <Flex
        align="center"
        justify="center"
        padding="sm"
        className={iconContainerClass}
      >
        <Icon aria-hidden className={`h-6 w-6 ${iconColorClass}`} strokeWidth={1.75} />
      </Flex>
      <Stack space={1} className="min-w-0 flex-1">
        <Span weight={labelWeight} size="sm" className={labelToneClass}>
          {method.label}
        </Span>
        {method.description && (
          <Span size="xs" tone="muted">
            {method.description}
          </Span>
        )}
      </Stack>
      {isComingSoon ? <ComingSoonBadge /> : <SelectionIndicator isSelected={isSelected} />}
    </Flex>
  );

  // 準備中: 非インタラクティブ要素として表示
  if (isComingSoon) {
    return (
      <Block className={`${cardClasses} cursor-not-allowed`} padding="md" aria-disabled>
        {innerContent}
      </Block>
    );
  }

  // 選択可能: 全面クリック可能なボタン
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={`block w-full p-3 text-left sm:p-4 ${cardClasses} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2`}
    >
      {innerContent}
    </button>
  );
}

type SupportedPaymentMethodsProps = {
  /** 選択中の支払い方法 ID（controlled）。未指定時は内部 state で保持 */
  value?: string | null;
  /** 選択変更時のコールバック（controlled）。未指定時は内部 state を更新 */
  onChange?: (methodId: string) => void;
};

/**
 * 対応している支払い方法の選択 UI
 *
 * payment.config.ts の paymentMethods をそのまま選択肢として表示する。
 * 表示順・ラベル・補足説明（対応ブランド等）・ステータスは全て config 側で制御可能。
 *
 * `value` / `onChange` を渡すと controlled として親が選択状態を管理する。
 * 未指定時は内部 state で保持する uncontrolled 動作になる。
 */
export function SupportedPaymentMethods({ value, onChange }: SupportedPaymentMethodsProps = {}) {
  const methods = getVisiblePaymentMethods();
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const isControlled = value !== undefined;
  const selectedId = isControlled ? value : internalSelectedId;

  const handleSelect = (id: string) => {
    if (isControlled) {
      onChange?.(id);
    } else {
      setInternalSelectedId(id);
      onChange?.(id);
    }
  };

  if (methods.length === 0) {
    return null;
  }

  return (
    <Stack space={3}>
      <Para size="sm" tone="muted" align="center">
        決済方法を選択してください
      </Para>
      <div role="radiogroup" aria-label="支払い方法">
        <Stack space={2}>
          {methods.map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              isSelected={selectedId === method.id}
              onSelect={() => handleSelect(method.id)}
            />
          ))}
        </Stack>
      </div>
    </Stack>
  );
}
