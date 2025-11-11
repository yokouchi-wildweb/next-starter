import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

const secTitleVariants = cva("", {
  variants: {
    variant: {
      // standard: セクションの見出しとして汎用的に使用。
      standard: "text-xl font-semibold",
      // emphasis: セクションを強調したいときの大きめ見出し。
      emphasis: "text-2xl font-semibold",
      // subtle: ラベル的に扱いたい控えめな見出し。
      subtle: "text-sm font-semibold text-muted-foreground",
      // barAccent: 帯で強調したいときに視線を集める見出し。
      barAccent:
        "relative my-4 pl-4 text-2xl text-primary before:absolute before:left-0.5 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded before:bg-gradient-to-b before:from-sky-300 before:to-sky-500",
    },
  },
  defaultVariants: {
    variant: "standard",
  },
});

type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type BaseHeadingProps = Omit<HTMLAttributes<HTMLHeadingElement>, "children"> & {
  children: ReactNode;
};

export type SecTitleProps = BaseHeadingProps &
  VariantProps<typeof secTitleVariants> & { as?: HeadingElement };

export function SecTitle({
  as,
  variant,
  className,
  children,
  ...props

}: SecTitleProps) {
  const Component = (as ?? "h2") as HeadingElement;
  return (
    <Component className={cn(secTitleVariants({ variant }), className)} {...props}>
      {children}
    </Component>
  );

}
