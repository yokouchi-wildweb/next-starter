import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { Input as ShadcnInput } from "@/components/_shadcn/input";

export type FileInputProps = Omit<ComponentPropsWithoutRef<typeof ShadcnInput>, "type" | "value"> & {
  resetKey?: number;
  selectedFileName?: string;
  onRemove?: () => void;
};

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  ({ resetKey = 0, selectedFileName, onRemove, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        <ShadcnInput key={resetKey} ref={ref} type="file" className={className} {...props} />
        {selectedFileName ? (
          <div className="flex items-center justify-between rounded border border-muted px-3 py-2 text-sm text-muted-foreground">
            <span className="truncate">{selectedFileName}</span>
            {onRemove ? (
              <button
                type="button"
                className="text-xs text-destructive underline-offset-4 hover:underline"
                onClick={onRemove}
              >
                クリア
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);

FileInput.displayName = "FileInput";
