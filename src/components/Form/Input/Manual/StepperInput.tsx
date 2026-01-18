// src/components/Form/Manual/StepperInput.tsx

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
  size?: Size;
  className?: string;
  value?: number;
  onValueChange?: (value: number) => void;
  buttonVariant?: ButtonStyleProps["variant"];
  buttonSize?: ButtonStyleProps["size"];
  /** 中央の値を直接入力できるようにするか */
  manualInputEnabled?: boolean;
};

export default function StepperInput({
  label,
  unit = "",
  initialValue = 0,
  step = 1,
  size = "s",
  className,
  value,
  onValueChange,
  buttonVariant,
  buttonSize,
  manualInputEnabled = true,
}: StepperInputProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const [manualInputValue, setManualInputValue] = useState(String(initialValue));
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  useEffect(() => {
    setManualInputValue(String(currentValue));
  }, [currentValue]);

  const updateValue = (nextValue: number) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  };

  const increase = () => updateValue(currentValue + step);
  const decrease = () => updateValue(currentValue - step);

  const resolvedVariant = buttonVariant ?? "ghost";
  const resolvedSize = buttonSize ?? "icon";
  const sharedButtonClassName = cn("rounded-none", iconSize[size as NonNullable<Size>]);

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
    }
  };

  return (
    <div className={cn(containerVariants({ size }), className)}>
      <span className="flex items-center bg-gray-700 px-4 text-white whitespace-nowrap">
        {label}
      </span>
      <Button
        type="button"
        variant={resolvedVariant}
        size={resolvedSize}
        onClick={decrease}
        className={sharedButtonClassName}
      >
        <MinusIcon className="size-4" />
      </Button>
      <div className="flex min-w-[4rem] items-center justify-center gap-1 px-2">
        {manualInputEnabled ? (
          <input
            type="number"
            inputMode="decimal"
            value={manualInputValue}
            onChange={handleManualInputChange}
            onBlur={handleManualInputBlur}
            className="w-[3rem] bg-transparent text-center text-base outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
        className={sharedButtonClassName}
      >
        <PlusIcon className="size-4" />
      </Button>
    </div>
  );
}
