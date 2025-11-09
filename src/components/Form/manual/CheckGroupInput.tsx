// src/components/Form/manual/CheckGroupInput.tsx

import { Options } from "@/types/form";
import { BookmarkTag } from "@/components/Form/button/BookmarkTag";
import { Button } from "@/components/Form/button/Button";
import { cn } from "@/lib/cn";

const TAG_BUTTON_BASE_CLASS = "h-auto px-3 py-1 text-sm border transition-colors";
const TAG_BUTTON_PILL_CLASS = "rounded-full";
const TAG_BUTTON_SELECTED_CLASS = "bg-primary text-primary-foreground border-primary";
const TAG_BUTTON_UNSELECTED_CLASS = "bg-muted text-muted-foreground border-border hover:bg-muted/80";

type Props = {
  field: {
    value?: string[];
    onChange: (value: string[]) => void;
  };
  /**
   * Options to choose from. Optional so the component can render
   * even when options haven't loaded yet.
   */
  options?: Options[];
  /** ブックマーク風の三角形を付ける */
  bookmark?: boolean;
};

export function CheckGroupInput({ field, options = [], bookmark = false, ...rest }: Props) {
  const toggle = (value: string) => {
    const values = field.value ?? [];
    if (values.includes(value)) {
      field.onChange(values.filter((v) => v !== value));
    } else {
      field.onChange([...values, value]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2" {...rest}>
      {options.map((op) => {
        const selected = field.value?.includes(op.value);
        const className = cn(
          TAG_BUTTON_BASE_CLASS,
          !bookmark && TAG_BUTTON_PILL_CLASS,
          selected ? TAG_BUTTON_SELECTED_CLASS : TAG_BUTTON_UNSELECTED_CLASS,
        );

        const button = (
          <Button
            type="button"
            key={op.value}
            onClick={() => toggle(op.value)}
            variant="ghost"
            className={className}
          >
            {op.label}
          </Button>
        );

        return bookmark ? (
          <BookmarkTag asChild key={op.value}>
            {button}
          </BookmarkTag>
        ) : (
          button
        );
      })}
    </div>
  );
}
