// src/features/core/messaging/components/common/TemplateEmbeddedInfoModal/index.tsx
// 部品(props だけ): 『専用の埋め込み情報を管理』のモーダル(D111 D126)。テンプレートの専用の埋め込み情報の宣言を足す・直す・消す。
// 行 = 鍵(英数字)・日本語の別名・型(1 行の文・数・日付・日時・URL・選択肢)・選択肢(選択肢の型だけ)・必須・既定値。
// 「適用」で呼び手が検査し(宣言の形・名前の重なり)、通れば閉じる。通らなければ errors を出す。
// 行の書きかけと検査は hook(useMessageTemplateForm の embeddedEditor)が持ち、この部品は描くだけ

"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/Form/Button";
import { BooleanCheckboxInput, Input, SelectInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { MESSAGE_EMBEDDED_TYPE_LABELS, MESSAGE_EMBEDDED_TYPES, type MessageEmbeddedType } from "@/lib/messaging";

/** 宣言の 1 行(画面の形。既定値は文字) */
export type TemplateEmbeddedInfoRow = {
  key: string;
  alias: string;
  type: MessageEmbeddedType;
  required: boolean;
  default: string;
  options: { value: string; label: string }[];
};

export type TemplateEmbeddedInfoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: readonly TemplateEmbeddedInfoRow[];
  onUpdateRow: (index: number, patch: Partial<TemplateEmbeddedInfoRow>) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  /** 適用(通れば呼び手が閉じる) */
  onApply: () => void;
  /** 適用で見つかった問題 */
  errors?: readonly string[];
  readOnly?: boolean;
};

const TYPE_OPTIONS = MESSAGE_EMBEDDED_TYPES.map((type) => ({ value: type, label: MESSAGE_EMBEDDED_TYPE_LABELS[type] }));

export function TemplateEmbeddedInfoModal({
  open,
  onOpenChange,
  rows,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onApply,
  errors = [],
  readOnly,
}: TemplateEmbeddedInfoModalProps) {
  const footer = (
    <Flex justify="end" gap="xs">
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
      <Stack space={4} data-slot="template-embedded-info">
        <Para size="sm" tone="muted" className="my-0">
          このテンプレートだけで使う埋め込み情報です。本文の中に {"{{別名}}"} と書くと、送信時に入力した値が入ります。別名は共通の埋め込み情報と重ねられません。
        </Para>
        {rows.length === 0 ? (
          <Span size="sm" tone="muted">
            専用の埋め込み情報はありません
          </Span>
        ) : null}
        {rows.map((row, index) => {
          const id = `embedded-${index}`;
          return (
            <Stack key={index} space={3} className="rounded-md border border-border bg-card p-3" data-slot="template-embedded-info-row">
              <Grid className="grid-cols-1 gap-3 md:grid-cols-3">
                <Stack space={1}>
                  <Label htmlFor={`${id}-alias`} className="text-xs">
                    別名(日本語)
                  </Label>
                  <Input id={`${id}-alias`} value={row.alias} readOnly={readOnly} placeholder="例: 締め切り日" onChange={(e) => onUpdateRow(index, { alias: e.target.value })} />
                </Stack>
                <Stack space={1}>
                  <Label htmlFor={`${id}-key`} className="text-xs">
                    鍵(英数字)
                  </Label>
                  <Input id={`${id}-key`} value={row.key} readOnly={readOnly} placeholder="例: deadline" className="font-mono" onChange={(e) => onUpdateRow(index, { key: e.target.value })} />
                </Stack>
                <Stack space={1}>
                  <Label htmlFor={`${id}-type`} className="text-xs">
                    型
                  </Label>
                  <SelectInput
                    id={`${id}-type`}
                    value={row.type}
                    options={TYPE_OPTIONS}
                    disabled={readOnly}
                    showPlaceholderOption={false}
                    onChange={(v) => onUpdateRow(index, { type: (v ? String(v) : "line") as MessageEmbeddedType })}
                  />
                </Stack>
              </Grid>
              {row.type === "select" ? (
                <Stack space={2} data-slot="template-embedded-info-options">
                  <Span size="xs" tone="muted">
                    選択肢
                  </Span>
                  {row.options.map((option, optionIndex) => (
                    <Flex key={optionIndex} align="center" gap="xs">
                      <Input
                        aria-label="値"
                        placeholder="値"
                        className="w-1/3"
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
                          aria-label="選択肢を削除"
                          onClick={() => onUpdateRow(index, { options: row.options.filter((_, i) => i !== optionIndex) })}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </Flex>
                  ))}
                  {readOnly ? null : (
                    <Flex>
                      <Button type="button" size="sm" variant="outline" onClick={() => onUpdateRow(index, { options: [...row.options, { value: "", label: "" }] })}>
                        <Plus className="size-4" />
                        選択肢を追加
                      </Button>
                    </Flex>
                  )}
                </Stack>
              ) : null}
              <Flex align="end" justify="between" gap="sm" wrap="wrap">
                <Flex align="end" gap="sm" wrap="wrap">
                  <Stack space={1}>
                    <Label htmlFor={`${id}-default`} className="text-xs">
                      既定値(任意)
                    </Label>
                    <Input id={`${id}-default`} value={row.default} readOnly={readOnly} onChange={(e) => onUpdateRow(index, { default: e.target.value })} />
                  </Stack>
                  <BooleanCheckboxInput
                    id={`${id}-required`}
                    label="必須"
                    value={row.required}
                    disabled={readOnly}
                    onChange={(checked) => onUpdateRow(index, { required: Boolean(checked) })}
                  />
                </Flex>
                {readOnly ? null : (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onRemoveRow(index)}>
                    <Trash2 className="size-4" />
                    削除
                  </Button>
                )}
              </Flex>
            </Stack>
          );
        })}
        {readOnly ? null : (
          <Flex>
            <Button type="button" size="sm" variant="outline" onClick={onAddRow}>
              <Plus className="size-4" />
              埋め込み情報を追加
            </Button>
          </Flex>
        )}
        {errors.length > 0 ? (
          <Stack space={1} data-slot="template-embedded-info-errors">
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
