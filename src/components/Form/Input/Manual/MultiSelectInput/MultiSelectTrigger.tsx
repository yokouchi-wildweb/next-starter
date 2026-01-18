// @/components/Form/Input/Manual/MultiSelectInput/MultiSelectTrigger.tsx

import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { cn } from "@/lib/cn";

type Props = {
  placeholder: string;
  selectedCount: number;
  open: boolean;
  disabled?: boolean;
  className?: string;
} & ComponentPropsWithoutRef<typeof Button>;

export const MultiSelectTrigger = forwardRef<HTMLButtonElement, Props>(
  ({ placeholder, selectedCount, open, disabled, className, ...props }, ref) => {
    const label = selectedCount > 0 ? `${selectedCount}件選択中` : placeholder;

    return (
      <Button
        ref={ref}
        type="button"
        variant="outline"
        size="md"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "h-auto w-full justify-between border-muted-foreground/50 py-3",
          selectedCount === 0 ? "text-muted-foreground" : "text-foreground",
          className,
        )}
        {...props}
      >
        <span className="truncate text-left">{label}</span>
        <ChevronsUpDownIcon className="ml-2 size-4 opacity-60" aria-hidden />
      </Button>
    );
  },
);

MultiSelectTrigger.displayName = "MultiSelectTrigger";
