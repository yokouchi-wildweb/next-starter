import { cva } from "class-variance-authority";

export type VariantDefinitions = Record<string, Record<string, string>>;

export const visualEffect = {
  /** 最もシンプルなブロック */
  default: "",
  /** 囲み枠で少しだけ強調したいとき */
  outline: "border border-border",
  /** 影を付けて存在感を出したいとき */
  raised: "shadow-lg",
} as const satisfies Record<string, string>;

export const space = {
  none: "",
  xs: "space-y-2",
  sm: "space-y-4",
  md: "space-y-6",
  lg: "space-y-8",
  xl: "space-y-10",
} as const satisfies Record<string, string>;

export const padding = {
  none: "",
  sx: "p-1",
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
  xl: "p-6",
} as const satisfies Record<string, string>;

export const paddingBlock = {
  none: "",
  sx: "py-1",
  sm: "py-2",
  md: "py-3",
  lg: "py-4",
  xl: "py-6",
} as const satisfies Record<string, string>;

export const paddingInline = {
  none: "",
  sx: "px-1",
  sm: "px-2",
  md: "px-3",
  lg: "px-4",
  xl: "px-6",
} as const satisfies Record<string, string>;

export const margin = {
  none: "",
  sx: "m-1",
  sm: "m-2",
  md: "m-3",
  lg: "m-4",
  xl: "m-6",
} as const satisfies Record<string, string>;

export const marginBlock = {
  none: "",
  sx: "my-1",
  sm: "my-2",
  md: "my-3",
  lg: "my-4",
  xl: "my-6",
} as const satisfies Record<string, string>;

export const marginInline = {
  none: "",
  sx: "mx-1",
  sm: "mx-2",
  md: "mx-3",
  lg: "mx-4",
  xl: "mx-6",
} as const satisfies Record<string, string>;

const baseLayoutVariants = {
  visualEffect,
  space,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
} satisfies VariantDefinitions;

const baseDefaultVariants = {
  visualEffect: "default",
  space: "none",
  padding: "none",
  paddingBlock: "none",
  paddingInline: "none",
  margin: "none",
  marginBlock: "none",
  marginInline: "none",
} as const satisfies Partial<Record<keyof typeof baseLayoutVariants, string>>;

type BaseVariantDefaults = {
  [Key in keyof typeof baseLayoutVariants]?: keyof (typeof baseLayoutVariants)[Key];
};

type CombinedDefaults<
  AdditionalVariants extends VariantDefinitions | undefined,
> = Partial<BaseVariantDefaults> &
  (AdditionalVariants extends VariantDefinitions
    ? Partial<{ [Key in keyof AdditionalVariants]: keyof AdditionalVariants[Key] }>
    : Record<never, never>);

type CreateLayoutVariantsOptions<AdditionalVariants extends VariantDefinitions | undefined> = {
  variants?: AdditionalVariants;
  defaultVariants?: CombinedDefaults<AdditionalVariants>;
  compoundVariants?: NonNullable<Parameters<typeof cva>[1]>["compoundVariants"];
};

export const createLayoutVariants = <
  AdditionalVariants extends VariantDefinitions | undefined = undefined,
>(
  baseClass: string,
  options?: CreateLayoutVariantsOptions<AdditionalVariants>,
) => {
  const { variants, defaultVariants, compoundVariants } = options ?? {};

  return cva(baseClass, {
    variants: {
      ...baseLayoutVariants,
      ...(variants ?? {}),
    },
    defaultVariants: {
      ...baseDefaultVariants,
      ...(defaultVariants ?? {}),
    } as Record<string, string>,
    compoundVariants,
  });
};

export type LayoutVariants = typeof baseLayoutVariants;

type VariantOptionProps<Definition extends VariantDefinitions> = {
  [Key in keyof Definition]?: keyof Definition[Key];
};

export type BaseLayoutVariantProps = VariantOptionProps<LayoutVariants>;

export type ComposeLayoutVariantProps<
  AdditionalVariants extends VariantDefinitions,
> = VariantOptionProps<LayoutVariants & AdditionalVariants>;
