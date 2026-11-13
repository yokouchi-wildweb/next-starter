// src/features/core/messaging/components/common/PreferenceCategoryWideToggle/index.tsx
// 部品(props だけ): 種類まるごと(すべての経路)の止め方の切り替え(入 = 止めている)。既定の画面は種類が最初に出る経路の行に 1 回だけ置く

"use client";

import { SwitchInput } from "@/components/Form/Input/Manual";

export type PreferenceCategoryWideToggleProps = {
  /** 種類の表示名(切り替えの読み上げ) */
  categoryLabel: string;
  /** 種類まるごとの行がある(応答の categories[].optedOut) */
  stopped: boolean;
  disabled?: boolean;
  /** stop = true で種類まるごとを止める */
  onChange: (stop: boolean) => void;
  /** 文言(既定「このカテゴリーをすべての経路で止める」) */
  label?: string;
};

export function PreferenceCategoryWideToggle({
  categoryLabel,
  stopped,
  disabled = false,
  onChange,
  label = "このカテゴリーをすべての経路で止める",
}: PreferenceCategoryWideToggleProps) {
  return (
    <SwitchInput
      value={stopped}
      onChange={(stop) => onChange(stop)}
      disabled={disabled}
      size="sm"
      label={label}
      aria-label={`${categoryLabel}をすべての経路で止める`}
    />
  );
}
