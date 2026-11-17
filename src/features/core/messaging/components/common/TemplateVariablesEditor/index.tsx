// src/features/core/messaging/components/common/TemplateVariablesEditor/index.tsx
// 部品(props だけ): テンプレートの専用の埋め込み情報の宣言(鍵・日本語の別名・型・必須・既定値、指令 58)。行を足す・消す。
// S5 で作り直すまでの最小の形: 選択肢の型(options が要る)は出さない。秘密の型は無い(秘密はコードの定義の secretVar に置く)

"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { Input, SelectInput, SwitchInput } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import type { TemplateVariableDraft } from "@/features/core/messaging/hooks/useMessageTemplateForm";
import { MESSAGE_EMBEDDED_TYPE_LABELS, type MessageEmbeddedType } from "@/lib/messaging";

/** 画面で選べる型(選択肢の型は S5 で options の入力と一緒に出す) */
export const TEMPLATE_VARIABLE_TYPES = (["line", "number", "date", "datetime", "url"] as const).map((type) => ({
  value: type,
  label: MESSAGE_EMBEDDED_TYPE_LABELS[type],
}));

export type TemplateVariablesEditorProps = {
  value: TemplateVariableDraft[];
  onChange: (value: TemplateVariableDraft[]) => void;
  disabled?: boolean;
};

const blank = (): TemplateVariableDraft => ({ key: "", alias: "", type: "line", required: false, default: "" });

export function TemplateVariablesEditor({ value, onChange, disabled }: TemplateVariablesEditorProps) {
  const update = (index: number, patch: Partial<TemplateVariableDraft>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Stack space={2} data-slot="template-variables-editor">
      {value.length === 0 ? (
        <Para size="sm" tone="muted" className="my-0">
          専用の埋め込み情報はありません(送信時に入力する値を {"{{鍵}}"} か {"{{別名}}"} で使う場合に追加します)
        </Para>
      ) : null}
      {value.map((row, index) => (
        <Flex key={index} align="center" gap="xs" wrap="wrap" className="rounded-md border border-border p-2">
          <Input
            aria-label="鍵"
            className="w-36 font-mono"
            placeholder="鍵(例: startAt)"
            value={row.key}
            disabled={disabled}
            onChange={(e) => update(index, { key: e.target.value })}
          />
          <Input
            aria-label="別名"
            className="w-36"
            placeholder="別名(例: 開始日時)"
            value={row.alias}
            disabled={disabled}
            onChange={(e) => update(index, { alias: e.target.value })}
          />
          <SelectInput
            aria-label="データ型"
            value={row.type}
            options={TEMPLATE_VARIABLE_TYPES}
            onChange={(v) => update(index, { type: (v ? String(v) : "line") as MessageEmbeddedType })}
          />
          <Input
            aria-label="初期値"
            className="w-32"
            placeholder="初期値(任意)"
            value={row.default}
            disabled={disabled}
            onChange={(e) => update(index, { default: e.target.value })}
          />
          <SwitchInput size="sm" value={row.required} onChange={(v) => update(index, { required: v })} label="必須" disabled={disabled} />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="この埋め込み情報を削除"
            disabled={disabled}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </Flex>
      ))}
      <Flex>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange([...value, blank()])}>
          <Plus className="size-4" />
          埋め込み情報を追加
        </Button>
      </Flex>
    </Stack>
  );
}
