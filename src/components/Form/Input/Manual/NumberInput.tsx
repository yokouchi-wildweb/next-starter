// @/components/Form/Input/Manual/NumberInput.tsx

"use client";

import { useEffect, useState, type ChangeEvent, type WheelEvent } from "react";
import { Input, type InputProps } from "./Input";

export type NumberInputProps = {
  /** 現在値 */
  value: number;
  /** 数値が確定したタイミングで呼ばれる。編集途中の空文字状態では呼ばない */
  onChange: (value: number) => void;
  /** 編集終了時のコールバック（呼び出し側でソート等に使う） */
  onBlur?: () => void;
  /** blur 時に clamp される下限 */
  min?: number;
  /** blur 時に clamp される上限 */
  max?: number;
} & Omit<InputProps, "value" | "onChange" | "type" | "onBlur">;

export function NumberInput({
  value,
  onChange,
  onBlur,
  onWheel,
  min,
  max,
  ...rest
}: NumberInputProps) {
  // 編集中の途中状態（空文字や "-" など）を保持するための string バッファ。
  // number state を直接持つと Number("") が 0 に化けて「0 が消せない」問題になるため、
  // 表示は常にこの text を使い、外部 value への反映は妥当な数値になったタイミングだけ行う。
  const [text, setText] = useState(String(value));

  // 外部 value が変化したら内部 text に同期する
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (v: number) => {
    let result = v;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    // 先頭の不要なゼロを除去（"01" → "1", "007" → "7", "0.5" はそのまま）
    const next = raw.replace(/^0+(?=\d)/, "");
    if (next !== raw) {
      event.target.value = next;
    }
    setText(next);

    // 空文字や "-" などの途中状態では外部 onChange を呼ばない
    if (next === "") return;
    const parsed = Number(next);
    if (Number.isNaN(parsed)) return;

    onChange(parsed);
  };

  const handleBlur = () => {
    if (text === "") {
      // 空のまま blur → 外部 value の表示に復元（外部 value は据え置き）
      setText(String(value));
    } else {
      const parsed = Number(text);
      if (Number.isNaN(parsed)) {
        // "-" 等のパース不能状態で blur → 外部 value の表示に復元
        setText(String(value));
      } else {
        const clamped = clamp(parsed);
        if (clamped !== parsed) {
          onChange(clamped);
        }
        setText(String(clamped));
      }
    }
    onBlur?.();
  };

  // ホイール操作による意図しない数値変更を防ぐ
  const handleWheel = (event: WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
    onWheel?.(event);
  };

  return (
    <Input
      type="number"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onWheel={handleWheel}
      min={min}
      max={max}
      {...rest}
    />
  );
}
