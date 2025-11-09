// src/components/Form/button/Button.tsx

import * as React from "react";

import { Button as ShadcnButton } from "@/components/Shadcn/button";
import { cn } from "@/lib/cn";

import { buttonVariants, type ButtonStyleProps } from "./button-variants";

export type ButtonProps = React.ComponentPropsWithoutRef<typeof ShadcnButton> & ButtonStyleProps;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <ShadcnButton
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);

Button.displayName = "FormButton";

export { Button, buttonVariants };
export type { ButtonStyleProps };
