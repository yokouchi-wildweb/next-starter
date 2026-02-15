// @/components/Form/Input/Manual/StepperInput.tsx

"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import { MinusIcon, PlusIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const containerVariants = cva(
  "inline-flex w-fit items-stretch overflow-hidden rounded-md border",
  {
    variants: {
      size: {
        s: "h-9 text-sm",
        m: "h-10 text-base",
        l: "h-12 text-base",
      },
    },
    defaultVariants: { size: "s" },
  },
);

type Size = VariantProps<typeof containerVariants>["size"];

const iconSize: Record<NonNullable<Size>, string> = {
  s: "size-9",
  m: "size-10",
  l: "size-12",
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
};

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
}: StepperInputProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const [manualInputValue, setManualInputValue] = useState(String(initialValue));
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  useEffect(() => {
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
    <div className={cn(containerVariants({ size }), className, disabled && "opacity-70")}>
      {label ? (
        <span className="flex items-center bg-gray-700 px-4 text-white whitespace-nowrap">
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
      <div className="flex min-w-[4rem] items-center justify-center gap-1 px-2">
        {manualInputEnabled ? (
          <input
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            value={manualInputValue}
            onChange={handleManualInputChange}
            onBlur={handleManualInputBlur}
            disabled={disabled}
            className={cn(
              "w-[3rem] bg-transparent text-center text-base outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
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
