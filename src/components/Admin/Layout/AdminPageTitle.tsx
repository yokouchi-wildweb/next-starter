// src/components/Admin/layout/AdminPageTitle.tsx

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

import { PageTitle, type PageTitleProps } from "@/components/TextBlocks";

const marginBottomClassMap = {
  xs: "mb-4",
  sm: "mb-8",
  md: "mb-12",
  lg: "mb-16",
  xl: "mb-20",
} as const;

const adminPageTitleVariants = cva(
  "relative px-4 py-2 text-3xl bg-gray-100 dark:bg-gray-800/40 after:absolute after:left-4 after:-bottom-1 after:h-1 after:w-12 after:rounded-full after:bg-gradient-to-r after:from-sky-300 after:to-sky-500 after:content-['']",
  {
    variants: {
      variant: {
        default: "",
      },
      marginBottom: marginBottomClassMap,
    },
    defaultVariants: {
      variant: "default",
      marginBottom: "md",
    },
  },
);

export type AdminPageTitleProps = PageTitleProps &
  VariantProps<typeof adminPageTitleVariants>;

export default function AdminPageTitle({
  variant,
  marginBottom,
  className,
  ...props
}: AdminPageTitleProps) {
  return (
    <PageTitle
        weight="normal"
      className={cn(
        adminPageTitleVariants({ variant, marginBottom }),
        className,
      )}
      {...props}
    />
  );
}
