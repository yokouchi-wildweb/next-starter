// src/components/Form/Manual/Input.tsx

import * as React from "react";

import { cn } from "@/lib/cn";
import { Input as ShadcnInput } from "@/components/_shadcn/input";

export type InputProps = React.ComponentProps<typeof ShadcnInput>;

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { className, readOnly, ...rest } = props;
  const readOnlyStyles = readOnly
    ? "bg-muted/50 text-muted-foreground cursor-not-allowed focus-visible:ring-0 focus-visible:border-border"
    : undefined;
  return <ShadcnInput ref={ref} readOnly={readOnly} className={cn(readOnlyStyles, className)} {...rest} />;
});

Input.displayName = "Input";

export { Input };
