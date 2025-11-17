// src/components/Admin/Elements/SecTitle.tsx

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

import { SecTitle as DefaultSecTitle, type SecTitleProps } from "@/components/TextBlocks";

const adminSecTitleVariants = cva("", {
  variants: {
    variant: {
      default:
        "relative my-4 pl-4 text-primary before:absolute before:left-1 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-gradient-to-b before:from-sky-300 before:to-sky-500",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type AdminSecTitleProps = SecTitleProps &
  VariantProps<typeof adminSecTitleVariants>;

export default function SecTitle({
  variant,
  className,
  size,
  ...props
}: AdminSecTitleProps) {
  const resolvedSize = size ?? "xl";
  const responsiveSizeClass = size ? undefined : "sm:text-2xl";

  return (
    <DefaultSecTitle
      weight="normal"
      size={resolvedSize}
      className={cn(adminSecTitleVariants({ variant }), responsiveSizeClass, className)}
      {...props}
    />
  );
}
