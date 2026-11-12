// src/features/core/messaging/components/common/TemplateVariablesEditor/index.tsx
// 部品(props だけ): テンプレートの変数の宣言(鍵・表示名・型・必須・由来・既定値)。行を足す・消す。
// 秘密の値は宣言できない(サーバーが拒む。秘密はコードの定義の secretVar に置く)

"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { Input, SelectInput, SwitchInput } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import type { TemplateVariableDraft } from "@/features/core/messaging/hooks/useMessageTemplateForm";

export const TEMPLATE_VARIABLE_TYPES = [
  { value: "string", label: "文字" },
  { value: "number", label: "数" },
  { value: "date", label: "日付" },
  { value: "url", label: "URL" },
];

const SOURCE_OPTIONS = [
  { value: "dispatch", label: "回に 1 つ" },
  { value: "recipient", label: "受信者ごと" },
];

export type TemplateVariablesEditorProps = {
  value: TemplateVariableDraft[];
  onChange: (value: TemplateVariableDraft[]) => void;
  disabled?: boolean;
};

const blank = (): TemplateVariableDraft => ({ key: "", label: "", type: "string", required: false, source: "dispatch", default: "" });

export function TemplateVariablesEditor({ value, onChange, disabled }: TemplateVariablesEditorProps) {
  const update = (index: number, patch: Partial<TemplateVariableDraft>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Stack space={2} data-slot="template-variables-editor">
      {value.length === 0 ? (
        <Para size="sm" tone="muted" className="my-0">
          変数はありません(送る時に入れる値を {"{{鍵}}"} で使うときに宣言する)
        </Para>
      ) : null}
      {value.map((row, index) => (
        <Flex key={index} align="center" gap="xs" wrap="wrap" className="rounded-md border border-border p-2">
          <Input
            aria-label="鍵"
            className="w-36 font-mono"
            placeholder="鍵(例: discount)"
            value={row.key}
            disabled={disabled}
            onChange={(e) => update(index, { key: e.target.value })}
          />
          <Input
            aria-label="表示名"
            className="w-36"
            placeholder="表示名"
            value={row.label}
            disabled={disabled}
            onChange={(e) => update(index, { label: e.target.value })}
          />
          <SelectInput
            aria-label="型"
            value={row.type}
            options={TEMPLATE_VARIABLE_TYPES}
            onChange={(v) => update(index, { type: v ? String(v) : "string" })}
          />
          <SelectInput
            aria-label="由来"
            value={row.source}
            options={SOURCE_OPTIONS}
            onChange={(v) => update(index, { source: v === "recipient" ? "recipient" : "dispatch" })}
          />
          <Input
            aria-label="既定値"
            className="w-32"
            placeholder="既定値(任意)"
            value={row.default}
            disabled={disabled}
            onChange={(e) => update(index, { default: e.target.value })}
          />
          <SwitchInput size="sm" value={row.required} onChange={(v) => update(index, { required: v })} label="必須" disabled={disabled} />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="この変数を消す"
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
          変数を足す
        </Button>
      </Flex>
    </Stack>
  );
}
