// src/features/core/messaging/components/common/SendLayoutPicker/index.tsx
// 部品(props だけ): 送るモーダルのレイアウトの選択(D171 D195)。自由連絡はレイアウトを直に選んで中身を書く。
// - 選択肢 = 管理画面で選べて無効でないレイアウト(呼び手の hook が選択肢から絞る)。初めの値は選択肢の initialLayout(hook)
// - テンプレートを読み込んだ間はそのテンプレートのレイアウト(選べないレイアウトなら空の表示)。ここで選ぶとテンプレートは外れる(hook)
// - 替えると欄の中身は白紙から、書きかけがあれば確かめるのは呼び手(hook + 入れ物の Dialog)
// - 選べるレイアウトが無い = テンプレートを読み込まないと送れない(その案内を出す)

"use client";

import { Label } from "@/components/Input/Label";
import { SelectInput } from "@/components/Input/Select";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

export type SendLayoutPickerProps = {
  /** 選べるレイアウト */
  layouts: readonly { key: string; label: string }[];
  /** 今のレイアウトの鍵(null = まだ無い) */
  value: string | null;
  onChange: (key: string) => void;
  /** 欄の id */
  id?: string;
  /** 見出し「レイアウト」を見た目から隠す(読み上げには残す)。呼び手が行の見出しを持つ時(送るモーダル) */
  hideLabel?: boolean;
  disabled?: boolean;
};

export function SendLayoutPicker({ layouts, value, onChange, id = "send-layout", hideLabel = false, disabled }: SendLayoutPickerProps) {
  if (layouts.length === 0) {
    return (
      <Span size="sm" tone="muted" data-slot="send-layout-picker">
        管理画面で選べるレイアウトが無いため、テンプレートを読み込んでください
      </Span>
    );
  }
  return (
    <Stack gap="2xs" className="min-w-40" data-slot="send-layout-picker">
      <Label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm"}>
        レイアウト
      </Label>
      <SelectInput
        id={id}
        // 選択肢に無いレイアウト(読み込んだテンプレートの選べないレイアウト)は空の表示
        value={value !== null && layouts.some((layout) => layout.key === value) ? value : ""}
        options={layouts.map((layout) => ({ value: layout.key, label: layout.label }))}
        placeholder="レイアウトを選択"
        showPlaceholderOption={false}
        disabled={disabled}
        onChange={(v) => {
          if (v) onChange(String(v));
        }}
      />
    </Stack>
  );
}
