// src/domains/core/messaging/components/common/TemplateVarsModal/index.tsx
// 部品(props だけ): 『専用の埋め込み情報を管理』のモーダル(D111 D126)。テンプレートの専用の埋め込み情報の宣言を足す・直す・消す。
// 行 = 鍵(英数字)・日本語の別名・型(1行テキスト・数・日付・日時・URL・選択肢)・選択肢(選択肢の型だけ)・必須・既定値。
// 見た目: 1 行 = 枠つきのカード(上の帯 = 番号・{{別名}}・必須のスイッチ・削除 / 下 = 別名 | 鍵 | 型 | 既定値 の 1 行、選択肢は中の枠)
// 「適用」で呼び手が検査し(宣言の形・名前の重なり)、通れば閉じる。通らなければ errors を出す。
// 行の書きかけと検査は hook(useMessageTemplateForm の varsEditor)が持ち、この部品は描くだけ

"use client";

import { Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { DateInput } from "@/components/Input/DateInput";
import { DatetimeInput } from "@/components/Input/DatetimeInput";
import { Input } from "@/components/Input/Input";
import { SelectInput } from "@/components/Input/Select";
import { SwitchInput } from "@/components/Input/SwitchInput";
import { Label } from "@/components/Input/Label";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { MESSAGE_VAR_TYPE_LABELS, MESSAGE_VAR_TYPES, type MessageVarType } from "@/lib/messaging";

/** 宣言の 1 行(画面の形。既定値は文字) */
export type TemplateVarRow = {
  key: string;
  alias: string;
  type: MessageVarType;
  required: boolean;
  default: string;
  options: { value: string; label: string }[];
};

export type TemplateVarsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: readonly TemplateVarRow[];
  onUpdateRow: (index: number, patch: Partial<TemplateVarRow>) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  /** 適用(通れば呼び手が閉じる) */
  onApply: () => void;
  /** 適用で見つかった問題 */
  errors?: readonly string[];
  readOnly?: boolean;
};

const TYPE_OPTIONS = MESSAGE_VAR_TYPES.map((type) => ({ value: type, label: MESSAGE_VAR_TYPE_LABELS[type] }));

export function TemplateVarsModal({
  open,
  onOpenChange,
  rows,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onApply,
  errors = [],
  readOnly,
}: TemplateVarsModalProps) {
  // このモーダルでは保存しない(D121): 「適用」はテンプレートの書きかけに入れるだけ。確定はテンプレートの保存
  const footer = (
    <Flex align="center" justify="end" gap="xs" wrap="wrap">
      {readOnly ? null : (
        <Span size="xs" tone="muted" className="mr-auto">
          テンプレートの保存で確定します
        </Span>
      )}
      <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)}>
        {readOnly ? "閉じる" : "キャンセル"}
      </Button>
      {readOnly ? null : (
        <Button type="button" size="sm" variant="primary" onClick={onApply}>
          適用
        </Button>
      )}
    </Flex>
  );
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="専用の埋め込み情報" maxWidth="960px" footer={footer}>
      <Stack gap="md" data-slot="template-vars-info">
        <Para size="sm" tone="muted" className="my-0">
          このテンプレートだけで使う埋め込み情報です。本文の中に {"{{別名}}"} と書くと、送信時に入力した値が入ります。別名は共通の埋め込み情報と重ねられません。
        </Para>
        {rows.length === 0 ? (
          <Span size="sm" tone="muted">
            専用の埋め込み情報はありません
          </Span>
        ) : null}
        {rows.map((row, index) => {
          const id = `vars-${index}`;
          const name = row.alias.trim() || row.key.trim();
          // 1 行 = 枠つきのカード: 上の帯(番号・書き方 {{別名}}・必須のスイッチ・削除)+ 下に 別名 | 鍵 | 型 | 既定値 を 1 行
          return (
            <Stack key={index} gap="none" className="overflow-hidden rounded-lg border border-border bg-card shadow-xs" data-slot="template-vars-info-row">
              <Flex align="center" justify="between" gap="md" className="border-b border-border bg-muted/50 py-1 pl-3 pr-1">
                <Flex align="center" gap="md" className="min-w-0">
                  <Span size="xs" weight="semiBold" tone="muted" className="min-w-6 rounded-md border border-border bg-background px-1.5 py-0.5 text-center tabular-nums">
                    {String(index + 1)}
                  </Span>
                  <Span size="sm" weight="semiBold" className={`min-w-0 truncate font-mono ${name ? "" : "text-muted-foreground"}`}>
                    {name ? `{{${name}}}` : "新しい埋め込み情報"}
                  </Span>
                </Flex>
                <Flex align="center" gap="md" className="shrink-0">
                  <SwitchInput
                    id={`${id}-required`}
                    label="必須"
                    size="sm"
                    value={row.required}
                    disabled={readOnly}
                    onChange={(checked) => onUpdateRow(index, { required: Boolean(checked) })}
                  />
                  {readOnly ? null : (
                    <Button type="button" size="icon" variant="destructiveGhost" className="size-8" aria-label="この埋め込み情報を削除" onClick={() => onRemoveRow(index)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </Flex>
              </Flex>
              <Stack gap="sm" className="p-3">
                <Grid className="grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,11rem)_minmax(0,1fr)]">
                  <Stack gap="2xs" className="min-w-0">
                    <Label htmlFor={`${id}-alias`} className="text-xs">
                      別名(日本語)
                    </Label>
                    <Input id={`${id}-alias`} value={row.alias} readOnly={readOnly} placeholder="例: 締め切り日" onChange={(e) => onUpdateRow(index, { alias: e.target.value })} />
                  </Stack>
                  <Stack gap="2xs" className="min-w-0">
                    <Label htmlFor={`${id}-key`} className="text-xs">
                      鍵(英数字)
                    </Label>
                    <Input id={`${id}-key`} value={row.key} readOnly={readOnly} placeholder="例: deadline" className="font-mono" onChange={(e) => onUpdateRow(index, { key: e.target.value })} />
                  </Stack>
                  <Stack gap="2xs" className="min-w-0">
                    <Label htmlFor={`${id}-type`} className="text-xs">
                      型
                    </Label>
                    <SelectInput
                      id={`${id}-type`}
                      value={row.type}
                      options={TYPE_OPTIONS}
                      disabled={readOnly}
                      showPlaceholderOption={false}
                      onChange={(v) => onUpdateRow(index, { type: (v ? String(v) : "line") as MessageVarType })}
                    />
                  </Stack>
                  <Stack gap="2xs" className="min-w-0">
                    <Label htmlFor={`${id}-default`} className="text-xs">
                      既定値(任意)
                    </Label>
                    {row.type === "select" ? (
                      // 選択肢の型 = その行の選択肢から選ぶ(値を手で打たない)。「なし」で既定値を外す
                      <SelectInput
                        id={`${id}-default`}
                        value={row.default}
                        options={row.options.filter((option) => option.value.trim() !== "").map((option) => ({ value: option.value, label: option.label || option.value }))}
                        disabled={readOnly}
                        includeNullOption
                        nullOptionLabel="なし"
                        placeholder={row.options.some((option) => option.value.trim() !== "") ? "なし" : "先に選択肢を追加"}
                        onChange={(v) => onUpdateRow(index, { default: v ? String(v) : "" })}
                      />
                    ) : row.type === "date" ? (
                      <DateInput id={`${id}-default`} className="w-full" value={row.default || null} disabled={readOnly} onValueChange={(v) => onUpdateRow(index, { default: v ?? "" })} />
                    ) : row.type === "datetime" ? (
                      <DatetimeInput
                        id={`${id}-default`}
                        className="w-full"
                        value={row.default || null}
                        outputFormat="iso"
                        disabled={readOnly}
                        onValueChange={(v) => onUpdateRow(index, { default: v ?? "" })}
                      />
                    ) : (
                      // 1行テキスト・数・URL = 型に合う入力の種類(数は数字の欄、URL は https:// の案内)
                      <Input
                        id={`${id}-default`}
                        type={row.type === "number" ? "number" : row.type === "url" ? "url" : "text"}
                        placeholder={row.type === "url" ? "https://" : undefined}
                        value={row.default}
                        readOnly={readOnly}
                        onChange={(e) => onUpdateRow(index, { default: e.target.value })}
                      />
                    )}
                  </Stack>
                </Grid>
                {row.type === "select" ? (
                  <Stack gap="xs" className="rounded-md border border-border bg-muted/20 p-3" data-slot="template-vars-info-options">
                    <Span size="xs" weight="semiBold" tone="muted">
                      選択肢
                    </Span>
                    {row.options.map((option, optionIndex) => (
                      <Flex key={optionIndex} align="center" gap="xs">
                        <Input
                          aria-label="値"
                          placeholder="値"
                          className="w-1/3 font-mono"
                          value={option.value}
                          readOnly={readOnly}
                          onChange={(e) =>
                            onUpdateRow(index, { options: row.options.map((item, i) => (i === optionIndex ? { ...item, value: e.target.value } : item)) })
                          }
                        />
                        <Input
                          aria-label="表示名"
                          placeholder="表示名"
                          className="flex-1"
                          value={option.label}
                          readOnly={readOnly}
                          onChange={(e) =>
                            onUpdateRow(index, { options: row.options.map((item, i) => (i === optionIndex ? { ...item, label: e.target.value } : item)) })
                          }
                        />
                        {readOnly ? null : (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive-text"
                            aria-label="選択肢を削除"
                            onClick={() => onUpdateRow(index, { options: row.options.filter((_, i) => i !== optionIndex) })}
                          >
                            <X className="size-3.5" />
                          </Button>
                        )}
                      </Flex>
                    ))}
                    {readOnly ? null : (
                      <Flex>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => onUpdateRow(index, { options: [...row.options, { value: "", label: "" }] })}
                        >
                          <Plus className="size-4" />
                          選択肢を追加
                        </Button>
                      </Flex>
                    )}
                  </Stack>
                ) : null}
              </Stack>
            </Stack>
          );
        })}
        {readOnly ? null : (
          <Button
            type="button"
            variant="none"
            className="flex h-auto w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            onClick={onAddRow}
            data-slot="template-vars-info-add"
          >
            <Plus className="size-4" />
            埋め込み情報を追加
          </Button>
        )}
        {errors.length > 0 ? (
          <Stack gap="2xs" data-slot="template-vars-info-errors">
            {errors.map((message) => (
              <Span key={message} size="sm" tone="destructive">
                {message}
              </Span>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Modal>
  );
}
