import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { Input as ShadcnInput } from "@/components/_shadcn/input";

export type FileInputProps = Omit<ComponentPropsWithoutRef<typeof ShadcnInput>, "type" | "value"> & {
  resetKey?: number;
};

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(({ resetKey = 0, ...props }, ref) => {
  return <ShadcnInput key={resetKey} ref={ref} type="file" {...props} />;
});

FileInput.displayName = "FileInput";
