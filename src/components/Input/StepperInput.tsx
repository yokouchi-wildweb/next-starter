// src/components/Input/StepperInput.tsx

"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Button } from "@/components/Button/Button";
import { type ButtonStyleProps } from "@/components/Button/variants";
import { MinusIcon, PlusIcon } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import type { FormControlA11yProps } from "./options";
import { variantOverrides } from "@/lib/variantOverrides/config";
import { createOverridableVariants, type StepperInputSize } from "@/lib/variantOverrides";

// 見た目の上書き口: src/config/lib/variantOverrides.config.ts の stepperInput({ base, size }、外枠)。既定のクラスはここ
// 高さは操作部品の高さの段(--control-h-*): xs = xxs 28px・s = sm 36px・m = md 44 / 40px・l = xl 48px(両端のボタンも同じ段の正方形)
const CONTAINER_SIZE = {
  xs: "h-(--control-h-xxs) text-xs",
  s: "h-(--control-h-sm) text-sm",
  m: "h-(--control-h-md) text-base",
  l: "h-(--control-h-xl) text-base",
} satisfies Record<StepperInputSize, string>;

const containerVariants = createOverridableVariants(
  "inline-flex w-fit items-stretch overflow-hidden rounded-md border",
  { variants: { size: CONTAINER_SIZE }, defaultVariants: { size: "s" } },
  variantOverrides.stepperInput,
);

type Size = VariantProps<typeof containerVariants>["size"];

const iconSize: Record<NonNullable<Size>, string> = {
  xs: "size-(--control-h-xxs)",
  s: "size-(--control-h-sm)",
  m: "size-(--control-h-md)",
  l: "size-(--control-h-xl)",
};

const centerWidth: Record<NonNullable<Size>, string> = {
  xs: "min-w-[2.25rem]",
  s: "min-w-[4rem]",
  m: "min-w-[4rem]",
  l: "min-w-[4rem]",
};

const manualInputSize: Record<NonNullable<Size>, string> = {
  xs: "w-[2rem] text-xs",
  s: "w-[3rem] text-base",
  m: "w-[3rem] text-base",
  l: "w-[3rem] text-base",
};

export type StepperInputProps = {
  label?: string;
  unit?: string;
  initialValue?: number;
  step?: number;
  /** 最小値 */
  min?: number;
  /** 最大値 */
  max?: number;
  size?: Size;
  className?: string;
  value?: number;
  onValueChange?: (value: number) => void;
  /** フォーカスが外れた時のコールバック（自動保存用） */
  onBlur?: () => void;
  buttonVariant?: ButtonStyleProps["variant"];
  buttonSize?: ButtonStyleProps["size"];
  /** 中央の値を直接入力できるようにするか */
  manualInputEnabled?: boolean;
  /** 無効化 */
  disabled?: boolean;
} & FormControlA11yProps; // id・aria-* は直接入力の欄へ(manualInputEnabled: false のときは role="group" の入れ物へ)

export default function StepperInput({
  label,
  unit = "",
  initialValue = 0,
  step = 1,
  min,
  max,
  size = "s",
  className,
  value,
  onValueChange,
  onBlur,
  buttonVariant,
  buttonSize,
  manualInputEnabled = true,
  disabled,
  id,
  "aria-describedby": ariaDescribedby,
  "aria-invalid": ariaInvalid,
}: StepperInputProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const [manualInputValue, setManualInputValue] = useState(String(initialValue));
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 描画の中で合わせるとサーバーの描画(初回の HTML)の欄の値が initialValue から今の値に変わる。今の出方を保つ
    setManualInputValue(String(currentValue));
  }, [currentValue]);

  const clamp = (v: number) => {
    let result = v;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  };

  const updateValue = (nextValue: number) => {
    const clamped = clamp(nextValue);
    if (!isControlled) {
      setInternalValue(clamped);
    }
    onValueChange?.(clamped);
    onBlur?.();
  };

  const atMin = min !== undefined && currentValue <= min;
  const atMax = max !== undefined && currentValue >= max;

  const increase = () => updateValue(currentValue + step);
  const decrease = () => updateValue(currentValue - step);

  const resolvedVariant = buttonVariant ?? "ghost";
  const resolvedSize = buttonSize ?? "icon";
  const sharedButtonClassName = cn("rounded-none bg-muted", iconSize[size as NonNullable<Size>]);

  const handleManualInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextText = event.target.value;
    setManualInputValue(nextText);

    if (nextText === "") {
      return;
    }

    const parsed = Number(nextText);
    if (Number.isNaN(parsed)) {
      return;
    }

    updateValue(parsed);
  };

  const handleManualInputBlur = () => {
    if (manualInputValue === "") {
      setManualInputValue(String(currentValue));
    } else {
      const parsed = Number(manualInputValue);
      if (!Number.isNaN(parsed)) {
        const clamped = clamp(parsed);
        if (clamped !== parsed) {
          updateValue(clamped);
          setManualInputValue(String(clamped));
        }
      }
    }
    onBlur?.();
  };

  return (
    <div
      className={cn(containerVariants({ size }), className, disabled && "opacity-70")}
      {...(manualInputEnabled ? {} : { role: "group", id, "aria-describedby": ariaDescribedby, "aria-invalid": ariaInvalid })}
    >
      {label ? (
        <span className="flex items-center bg-foreground px-4 text-background whitespace-nowrap">
          {label}
        </span>
      ) : null}
      <Button
        type="button"
        variant={resolvedVariant}
        size={resolvedSize}
        onClick={decrease}
        disabled={disabled || atMin}
        className={cn(sharedButtonClassName, "border-r")}
      >
        <MinusIcon className="size-4" />
      </Button>
      <div
        className={cn(
          "flex items-center justify-center gap-1 px-2",
          centerWidth[size as NonNullable<Size>]
        )}
      >
        {manualInputEnabled ? (
          <input
            id={id}
            aria-describedby={ariaDescribedby}
            aria-invalid={ariaInvalid}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            value={manualInputValue}
            onChange={handleManualInputChange}
            onBlur={handleManualInputBlur}
            disabled={disabled}
            className={cn(
              "bg-transparent text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              manualInputSize[size as NonNullable<Size>],
              disabled && "cursor-not-allowed"
            )}
          />
        ) : (
          <span>{currentValue}</span>
        )}
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      <Button
        type="button"
        variant={resolvedVariant}
        size={resolvedSize}
        onClick={increase}
        disabled={disabled || atMax}
        className={cn(sharedButtonClassName, "border-l")}
      >
        <PlusIcon className="size-4" />
      </Button>
    </div>
  );
}
