"use client";

import { useState } from "react";
import { Button } from "@/components/Form/Button";
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
  label: string;
  unit?: string;
  initialValue?: number;
  step?: number;
  size?: Size;
  className?: string;
  value?: number;
  onValueChange?: (value: number) => void;
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
}: StepperInputProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const updateValue = (nextValue: number) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  };

  const increase = () => updateValue(currentValue + step);
  const decrease = () => updateValue(currentValue - step);

  return (
    <div className={cn(containerVariants({ size }), className)}>
      <span className="flex items-center bg-gray-700 px-4 text-white whitespace-nowrap">
        {label}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={decrease}
        className={cn("rounded-none", iconSize[size as NonNullable<Size>])}
      >
        <MinusIcon className="size-4" />
      </Button>
      <span className="flex min-w-[3rem] items-center justify-center px-2">
        {currentValue}
        {unit}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={increase}
        className={cn("rounded-none", iconSize[size as NonNullable<Size>])}
      >
        <PlusIcon className="size-4" />
      </Button>
    </div>
  );
}
