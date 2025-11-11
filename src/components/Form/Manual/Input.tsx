// src/components/Form/Manual/Input.tsx

import * as React from "react";

import { Input as ShadcnInput } from "@/components/Shadcn/input";

export type InputProps = React.ComponentProps<typeof ShadcnInput>;

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <ShadcnInput ref={ref} {...props} />;
});

Input.displayName = "Input";

export { Input };
