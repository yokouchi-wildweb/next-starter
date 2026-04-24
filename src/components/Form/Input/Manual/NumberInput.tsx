// @/components/Form/Input/Manual/NumberInput.tsx

"use client";

import { useState, type ChangeEvent, type WheelEvent } from "react";
import { Input, type InputProps } from "./Input";

type NumberInputBaseProps = {
  /** blur 時に clamp される下限 */
  min?: number;
  /** blur 時に clamp される上限 */
  max?: number;
  /** 編集終了時のコールバック（呼び出し側でソート等に使う） */
  onBlur?: () => void;
} & Omit<InputProps, "value" | "onChange" | "type" | "onBlur">;

/**
 * NumberInput の型。`nullable` prop で null 許容モードに切り替える。
 *
 * - `nullable` 未指定 / false: value は number。空入力で blur しても外部 value に復元される
 * - `nullable` true: value は number | null。空入力で blur すると onChange(null) が呼ばれる
 */
export type NumberInputProps =
  | (NumberInputBaseProps & {
      nullable?: false;
      /** 現在値 */
      value: number;
      /** 数値が確定したタイミングで呼ばれる。編集途中の空文字状態では呼ばない */
      onChange: (value: number) => void;
    })
  | (NumberInputBaseProps & {
      nullable: true;
      /** 現在値。null は「未設定」を表す */
      value: number | null;
      /** 数値または null が確定したタイミングで呼ばれる。"-" 等の途中状態では呼ばない */
      onChange: (value: number | null) => void;
    });

export function NumberInput(props: NumberInputProps) {
  const {
    value,
    onChange,
    onBlur,
    onWheel,
    min,
    max,
    nullable,
    ...rest
  } = props;

  // 編集中の途中状態（空文字や "-" など）を保持するための string バッファ。
  // number state を直接持つと Number("") が 0 に化ける問題があるため、
  // 表示は常にこの text を使い、外部 value への反映は妥当な数値になったタイミングだけ行う。
  const [text, setText] = useState(value === null ? "" : String(value));
  // 外部 value の変化を内部 text に反映するための in-render state update。
  // useEffect + setState は react-hooks/set-state-in-effect に反するため、
  // React 推奨の prop 追従パターン（前回値と比較して render 中に setState）を採用する。
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value === null ? "" : String(value));
  }

  const clamp = (v: number) => {
    let result = v;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  };

  // nullable フラグで外部 onChange の型が異なるため、内部では number | null を扱い、
  // 外部に渡すタイミングでだけ分岐する。非 nullable で null を渡そうとするケースは
  // handleBlur 側で発生させず text を value に戻す設計のため、ここでは黙殺する。
  const emit = (next: number | null) => {
    if (nullable) {
      (onChange as (v: number | null) => void)(next);
    } else if (next !== null) {
      (onChange as (v: number) => void)(next);
    }
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

    emit(parsed);
  };

  const handleBlur = () => {
    if (text === "") {
      if (nullable) {
        // nullable モード: 空 = 未設定として null を確定
        emit(null);
      } else {
        // 非 nullable モード: 外部 value の表示に復元（外部 state 不変）
        setText(value === null ? "" : String(value));
      }
    } else {
      const parsed = Number(text);
      if (Number.isNaN(parsed)) {
        // "-" 等のパース不能状態で blur → 外部 value の表示に復元
        setText(value === null ? "" : String(value));
      } else {
        const clamped = clamp(parsed);
        if (clamped !== parsed) {
          emit(clamped);
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
