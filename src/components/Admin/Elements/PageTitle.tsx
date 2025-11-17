// src/components/Admin/Elements/PageTitle.tsx

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

import { PageTitle as DefaultPageTitle, type PageTitleProps } from "@/components/TextBlocks";

const marginBottomClassMap = {
  xs: "mb-2",
  sm: "mb-5",
  md: "mb-8",
  lg: "mb-10",
  xl: "mb-14",
} as const;

const adminPageTitleVariants = cva(
  "relative px-4 py-2 bg-gray-100 dark:bg-gray-800/40 after:absolute after:left-4 after:-bottom-1 after:h-1 after:w-12 after:rounded-full after:bg-gradient-to-r after:from-sky-300 after:to-sky-500 after:content-['']",
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

export default function PageTitle({
  variant,
  marginBottom,
  className,
  size,
  ...props
}: AdminPageTitleProps) {
  const resolvedSize = size ?? "xxl";
  const responsiveSizeClass = size ? undefined : "sm:text-3xl";

  return (
    <DefaultPageTitle
      weight="normal"
      size={resolvedSize}
      className={cn(
        adminPageTitleVariants({ variant, marginBottom }),
        responsiveSizeClass,
        className,
      )}
      {...props}
    />
  );
}
