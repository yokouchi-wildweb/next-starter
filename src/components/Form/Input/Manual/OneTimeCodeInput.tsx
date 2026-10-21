// @/components/Form/Input/Manual/OneTimeCodeInput.tsx
//
// ワンタイムコード（ペアリングコード・確認コード等）の入力欄。
// 入力を大文字にそろえ、許可した文字以外を捨て、groupSize ごとにハイフンで区切って表示する。
// onChange には区切りを除いた値を渡す。length 文字そろうと onComplete を呼ぶ（自動送信に使う）。

import * as React from "react";

import { cn } from "@/lib/cn";

import { Input, type InputProps } from "./Input";

export type OneTimeCodeInputProps = Omit<InputProps, "value" | "onChange" | "maxLength"> & {
  /** 区切りを除いた値 */
  value: string;
  onChange: (value: string) => void;
  /** コードの文字数（既定 8） */
  length?: number;
  /** 表示上の区切り（既定 4 文字ごと。0 で区切らない） */
  groupSize?: number;
  /**
   * 1 文字ずつ許可するかの判定（大文字化した後の文字が渡る）。
   * 既定は英数字（Crockford Base32 の入力ゆれ I / L / O も受け付け、照合はサーバー側で正規化する）
   */
  allowChar?: (char: string) => boolean;
  /** length 文字そろったときに呼ぶ */
  onComplete?: (value: string) => void;
};

const defaultAllowChar = (char: string) => /^[0-9A-Z]$/.test(char);

const formatGroups = (value: string, groupSize: number) => {
  if (groupSize <= 0) return value;
  const groups: string[] = [];
  for (let i = 0; i < value.length; i += groupSize) {
    groups.push(value.slice(i, i + groupSize));
  }
  return groups.join("-");
};

const OneTimeCodeInput = React.forwardRef<HTMLInputElement, OneTimeCodeInputProps>((props, ref) => {
  const {
    value,
    onChange,
    length = 8,
    groupSize = 4,
    allowChar = defaultAllowChar,
    onComplete,
    className,
    placeholder,
    ...rest
  } = props;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.value.toUpperCase())
      .filter(allowChar)
      .join("")
      .slice(0, length);
    if (next === value) return;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="text"
      autoComplete="one-time-code"
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      value={formatGroups(value, groupSize)}
      onChange={handleChange}
      placeholder={placeholder ?? formatGroups("X".repeat(length), groupSize)}
      className={cn("text-center font-mono text-xl tracking-widest", className)}
      {...rest}
    />
  );
});

OneTimeCodeInput.displayName = "OneTimeCodeInput";

export { OneTimeCodeInput };
