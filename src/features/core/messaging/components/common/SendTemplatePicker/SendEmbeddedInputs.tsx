// src/features/core/messaging/components/common/SendTemplatePicker/SendEmbeddedInputs.tsx
// 部品(props だけ): 読み込んだテンプレートの専用の埋め込み情報の値(回に 1 組、D111 D126)。宣言の順に、日本語の別名を見出しにして型ごとの入力を出す
// (1 行の文・数・URL = 文字、日付、日時 = ISO、選択肢)。値はいつも文字で持ち、数への読み替えは hook。既定値は仮の文に出す

"use client";

import { DateInput, DatetimeInput, Input, SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";
import type { MessageEmbeddedDeclaration } from "@/lib/messaging";

export type SendEmbeddedInputsProps = {
  declarations: readonly MessageEmbeddedDeclaration[];
  values: Readonly<Record<string, string>>;
  onChange: (key: string, value: string) => void;
  /** 入っていない必須の鍵(印を付ける) */
  missing?: readonly string[];
};

export function SendEmbeddedInputs({ declarations, values, onChange, missing = [] }: SendEmbeddedInputsProps) {
  if (declarations.length === 0) {
    return (
      <Span size="sm" tone="muted" data-slot="send-embedded-inputs">
        このテンプレートに専用の埋め込み情報はありません
      </Span>
    );
  }
  return (
    <Stack space={3} data-slot="send-embedded-inputs">
      {declarations.map((declaration) => {
        const id = `send-embedded-${declaration.key}`;
        const value = values[declaration.key] ?? "";
        const placeholder = declaration.default !== undefined ? `初期値: ${String(declaration.default)}` : undefined;
        return (
          <Stack key={declaration.key} space={1}>
            <Label htmlFor={id} className="text-sm">
              {declaration.alias || declaration.key}
              {declaration.required ? <Span tone="destructive"> *</Span> : null}
              <Span size="xs" tone="muted" className="ml-2 font-mono">{`{{${declaration.alias || declaration.key}}}`}</Span>
            </Label>
            {declaration.type === "select" ? (
              <SelectInput
                id={id}
                value={value}
                options={(declaration.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
                placeholder={placeholder ?? "選ぶ"}
                onChange={(v) => onChange(declaration.key, v ? String(v) : "")}
              />
            ) : declaration.type === "date" ? (
              <DateInput id={id} value={value || null} onValueChange={(v) => onChange(declaration.key, v)} />
            ) : declaration.type === "datetime" ? (
              <DatetimeInput id={id} value={value || null} outputFormat="iso" onValueChange={(v) => onChange(declaration.key, v)} />
            ) : (
              <Input
                id={id}
                type={declaration.type === "number" ? "number" : declaration.type === "url" ? "url" : "text"}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(declaration.key, e.target.value)}
              />
            )}
            {missing.includes(declaration.key) ? (
              <Span size="xs" tone="destructive">
                入力してください
              </Span>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
