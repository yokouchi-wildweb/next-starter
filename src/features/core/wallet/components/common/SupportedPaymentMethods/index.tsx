// src/features/core/wallet/components/common/SupportedPaymentMethods/index.tsx
// payment.config.ts の paymentMethods をベースに、対応支払い方法を選択可能なカードリストとして表示する。
// 表示対象は status が "available" / "coming_soon" のもの（disabled は除外）。
//
// available: ラジオ的に選択可能（primary カラーで強調）
// coming_soon: 非アクティブ表示（"準備中" バッジ付き、選択不可、warning 黄系）
// blocked (props): 動的に「選択不可」状態を強制する（destructive 赤系）。
//                   進行中の自社銀行振込がある時に bank_transfer_inhouse をブロックする等の用途。

"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight, CreditCard, Landmark, ShoppingCart, Smartphone, Store, Wallet } from "lucide-react";
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

function BlockedBadge({ label }: { label: string }) {
  return (
    <Span
      size="xs"
      className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive"
    >
      {label}
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
  /** undefined なら通常表示。値が入っている時は選択不可（赤系の destructive 表示） */
  blocked?: BlockedPaymentMethod;
  onSelect: () => void;
};

function PaymentMethodCard({ method, isSelected, blocked, onSelect }: CardProps) {
  const Icon = resolveIcon(method.icon);
  const isComingSoon = method.status === "coming_soon";
  const isBlocked = blocked !== undefined;
  // 「ブロック中だがクリックで進行中セッションへ戻れる」モード（redirectUrl 指定時）
  const blockedRedirectUrl = blocked?.redirectUrl;
  const isBlockedClickable = isBlocked && blockedRedirectUrl !== undefined;
  // インタラクティブにするかどうか（選択ボタンとして動くか）
  const isInteractive = !isComingSoon && !isBlocked;

  // カード本体のクラス（状態別）
  // ※ 全状態で border-2 に統一して状態切替時の縦方向レイアウトシフトを防ぐ。
  //   選択時の強調はリング (ring-2) と border-color で表現する（ring は box-shadow 実装なのでレイアウトに影響しない）。
  // ※ 背景色は常に不透明な bg-card 系で保持し、半透明 tint (bg-primary/5 等) は使わない。
  //   半透明だと親要素が透けて選択時に見た目が抜けて見えるため。
  let cardClasses: string;
  if (isBlockedClickable) {
    // 進行中セッションへの復帰リンクとして機能する。opacity を落とさず hover 効果を持たせる
    cardClasses =
      "rounded-lg border-2 border-dashed border-destructive/40 bg-background transition-colors hover:bg-destructive/5";
  } else if (isBlocked) {
    cardClasses =
      "rounded-lg border-2 border-dashed border-destructive/40 bg-background opacity-70";
  } else if (isComingSoon) {
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
  if (isBlocked) {
    iconContainerClass =
      "shrink-0 rounded-xl bg-gradient-to-br from-destructive/30 via-destructive/15 to-destructive/5 shadow-sm ring-1 ring-inset ring-destructive/25";
  } else if (isComingSoon) {
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
  const iconColorClass = isBlocked
    ? "text-destructive"
    : isComingSoon
      ? "text-warning"
      : isSelected
        ? "text-primary"
        : "text-muted-foreground";

  // ラベル色 / 太さ
  const labelToneClass = isSelected ? "text-primary" : "";
  const labelWeight = isSelected ? "semiBold" : "medium";

  // blocked 時は description を blocked.message に差し替え（理由を案内する優先表示）
  const descriptionText = isBlocked ? blocked.message : method.description;

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
        {descriptionText && (
          <Span size="xs" tone={isBlocked ? "destructive" : "muted"}>
            {descriptionText}
          </Span>
        )}
      </Stack>
      {isBlocked ? (
        <Flex align="center" gap="xs">
          <BlockedBadge label={blocked.badge ?? "進行中"} />
          {/* クリックで進行中セッションへ復帰できることを示すシェブロン */}
          {isBlockedClickable && (
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-destructive/60" />
          )}
        </Flex>
      ) : isComingSoon ? (
        <ComingSoonBadge />
      ) : (
        <SelectionIndicator isSelected={isSelected} />
      )}
    </Flex>
  );

  // ブロック中 + redirectUrl あり: 進行中セッションへの復帰リンクとして機能する
  if (isBlockedClickable) {
    return (
      <Link href={blockedRedirectUrl} className="block">
        <Block className={`${cardClasses} cursor-pointer`} padding="md">
          {innerContent}
        </Block>
      </Link>
    );
  }

  // 非インタラクティブ (blocked / coming_soon): 静的 Block で表示
  if (!isInteractive) {
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

/**
 * 動的に「選択不可」状態を強制したい支払い方法の指定。
 * 例: 進行中の自社銀行振込がある時に bank_transfer_inhouse をブロックして
 *     重複申し込みを UI 側で先回りに防ぐ。
 */
export type BlockedPaymentMethod = {
  /** 対象の payment method ID（payment.config.ts の paymentMethods[].id と一致） */
  id: string;
  /** 右端に出す赤系バッジのラベル（省略時 "進行中"） */
  badge?: string;
  /** 補足説明（method.description を上書き）。理由案内に使う */
  message?: string;
  /**
   * 指定時、カードがクリック可能になり、押下するとこの URL へ遷移する。
   * 進行中セッションがあるときに「その案内画面に復帰する」復帰導線として使う。
   * 省略時はカードは選択不可かつクリック不可（純粋な disabled 表示）。
   */
  redirectUrl?: string;
};

type SupportedPaymentMethodsProps = {
  /** 選択中の支払い方法 ID（controlled）。未指定時は内部 state で保持 */
  value?: string | null;
  /** 選択変更時のコールバック（controlled）。未指定時は内部 state を更新 */
  onChange?: (methodId: string) => void;
  /**
   * 動的にブロックする支払い方法の一覧。該当 method ID は赤系の destructive 表示になり
   * 選択不可になる。空配列または未指定なら通常通り全て選択可能。
   */
  blockedMethods?: BlockedPaymentMethod[];
};

/**
 * 対応している支払い方法の選択 UI
 *
 * payment.config.ts の paymentMethods をそのまま選択肢として表示する。
 * 表示順・ラベル・補足説明（対応ブランド等）・ステータスは全て config 側で制御可能。
 *
 * `value` / `onChange` を渡すと controlled として親が選択状態を管理する。
 * 未指定時は内部 state で保持する uncontrolled 動作になる。
 *
 * `blockedMethods` で動的に選択不可を指定できる（赤系表示）。
 */
export function SupportedPaymentMethods({
  value,
  onChange,
  blockedMethods,
}: SupportedPaymentMethodsProps = {}) {
  const methods = getVisiblePaymentMethods();
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const isControlled = value !== undefined;
  const selectedId = isControlled ? value : internalSelectedId;

  // ID → BlockedPaymentMethod のマップ化（毎レンダーで作るが要素数 5 程度なので無視できるコスト）
  const blockedMap = new Map<string, BlockedPaymentMethod>();
  for (const b of blockedMethods ?? []) {
    blockedMap.set(b.id, b);
  }

  const handleSelect = (id: string) => {
    // ブロック対象の手動クリックを念のため弾く（disabled なボタンなので通常到達しない）
    if (blockedMap.has(id)) return;
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
              blocked={blockedMap.get(method.id)}
              onSelect={() => handleSelect(method.id)}
            />
          ))}
        </Stack>
      </div>
    </Stack>
  );
}
