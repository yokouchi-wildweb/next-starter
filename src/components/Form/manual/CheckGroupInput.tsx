// src/components/Form/manual/CheckGroupInput.tsx

import { Options } from "@/types/form";
import { BookmarkTag } from "@/components/Form/button/BookmarkTag";
import { TagButton } from "@/components/Form/button/TagButton";

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
        if (bookmark) {
          return (
            <BookmarkTag
              key={op.value}
              type="button"
              selected={selected}
              onClick={() => toggle(op.value)}
            >
              {op.label}
            </BookmarkTag>
          );
        }

        return (
          <TagButton
            key={op.value}
            type="button"
            selected={selected}
            onClick={() => toggle(op.value)}
          >
            {op.label}
          </TagButton>
        );
      })}
    </div>
  );
}
