// src/components/Form/Button/LinkButton.tsx

import { baseButtonClassName } from "@/components/Primitives/Button";
import { Link, type LinkProps } from "@/components/Navigation/Link";
import { cn } from "@/lib/cn";

import { buttonVariants, type ButtonStyleProps } from "./button-variants";

/** 棚の Link の props(gate を含む: 閉じた機能の住所は既定で描かない)+ ボタンの見た目 */
export type LinkButtonProps = LinkProps & ButtonStyleProps;

export function LinkButton({
  variant,
  size,
  opticalAdjust,
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(baseButtonClassName, buttonVariants({ variant, size, opticalAdjust }), className)}
      {...props}
    />
  );
}
