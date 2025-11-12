// src/components/Admin/layout/AdminPageTitle.tsx

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

import { PageTitle, type PageTitleProps } from "@/components/TextBlocks";

const adminPageTitleVariants = cva("", {
  variants: {
    variant: {
      default:
        "relative mb-12 px-4 py-2 text-3xl font-bold bg-gray-100 dark:bg-gray-800/40 after:absolute after:left-4 after:-bottom-1 after:h-1 after:w-12 after:rounded-full after:bg-gradient-to-r after:from-sky-300 after:to-sky-500 after:content-['']",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type AdminPageTitleProps = PageTitleProps &
  VariantProps<typeof adminPageTitleVariants>;

export default function AdminPageTitle({
  variant,
  className,
  ...props
}: AdminPageTitleProps) {
  return (
    <PageTitle
      className={cn(adminPageTitleVariants({ variant }), className)}
      {...props}
    />
  );
}
