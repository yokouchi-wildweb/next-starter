// src/domains/core/messaging/components/common/PreferenceCategoryWideToggle/index.tsx
// 部品(props だけ): カテゴリーまるごと(すべての送信チャンネル)の止め方の切り替え(入 = 止めている)。既定の画面はカテゴリーが最初に出る送信チャンネルの行に 1 回だけ置く
// 全部の停止の間(stoppedByAll)は止まっている(入)で見せて押せない(状態は全部に従う)

"use client";

import { SwitchInput } from "@/components/Input/SwitchInput";

export type PreferenceCategoryWideToggleProps = {
  /** カテゴリーの表示名(切り替えの読み上げ) */
  categoryLabel: string;
  /** カテゴリーまるごとの行がある(応答の categories[].optedOut) */
  stopped: boolean;
  disabled?: boolean;
  /** すべての連絡を止めている(応答の allOptedOut)。入で見せて押せなくする */
  stoppedByAll?: boolean;
  /** stop = true でカテゴリーまるごとを止める */
  onChange: (stop: boolean) => void;
  /** 文言(既定「このカテゴリーをすべての通知方法で受け取らない」) */
  label?: string;
};

export function PreferenceCategoryWideToggle({
  categoryLabel,
  stopped,
  disabled = false,
  stoppedByAll = false,
  onChange,
  label = "このカテゴリーをすべての通知方法で受け取らない",
}: PreferenceCategoryWideToggleProps) {
  return (
    <SwitchInput
      value={stoppedByAll || stopped}
      onChange={(stop) => onChange(stop)}
      disabled={disabled || stoppedByAll}
      size="sm"
      label={label}
      aria-label={`${categoryLabel}をすべての通知方法で受け取らない`}
    />
  );
}
