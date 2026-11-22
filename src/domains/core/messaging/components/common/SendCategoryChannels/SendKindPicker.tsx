// src/domains/core/messaging/components/common/SendCategoryChannels/SendKindPicker.tsx
// 部品(props だけ): 送るモーダルの最初の段 = 種別(D110。運営告知・個別連絡・プロモーションのうち、送れるカテゴリーがある物)。
// 運用者が送る意図を自分で選ぶ。宛先とテンプレートは選んだ種別が許す物だけになる(hook)

"use client";

import { RadioGroupInput } from "@/components/Input/RadioGroupInput";
import { Para } from "@/components/TextBlocks/Para";

export type SendKindPickerProps = {
  kinds: { key: string; label: string }[];
  value: string;
  onChange: (kind: string) => void;
};

export function SendKindPicker({ kinds, value, onChange }: SendKindPickerProps) {
  if (kinds.length === 0) {
    return (
      <Para size="sm" tone="muted" className="my-0" data-slot="send-kind-picker">
        管理画面から送れる種別がありません
      </Para>
    );
  }
  return (
    <RadioGroupInput
      data-slot="send-kind-picker"
      value={value}
      options={kinds.map((kind) => ({ value: kind.key, label: kind.label }))}
      onChange={(v) => onChange(v ? String(v) : "")}
    />
  );
}
