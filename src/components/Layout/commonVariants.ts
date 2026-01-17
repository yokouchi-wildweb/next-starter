import { cva } from "class-variance-authority";
import { appearance } from "./appearance";
export { appearance } from "./appearance";


export const space = {
  none: "flex flex-col gap-0",
  xs: "flex flex-col gap-2",
  sm: "flex flex-col gap-4",
  md: "flex flex-col gap-6",
  lg: "flex flex-col gap-8",
  xl: "flex flex-col gap-10",
} as const;

export const padding = {
  none: "p-0",
  xs: "p-1",
  sm: "p-2",
  md: "p-3 sm:p-4",
  lg: "p-4 sm:p-6",
  xl: "p-6 sm:p-10",
} as const;

export const paddingBlock = {
  none: "py-0",
  xs: "py-1",
  sm: "py-2",
  md: "py-3 sm:py-4",
  lg: "py-4 sm:py-6",
  xl: "py-6 sm:py-10",
} as const;

export const paddingInline = {
  none: "px-0",
  xs: "px-1",
  sm: "px-2",
  md: "px-3 sm:px-4",
  lg: "px-4 sm:px-6",
  xl: "px-6 sm:px-10",
} as const;

export const margin = {
  none: "m-0",
  xs: "m-1",
  sm: "m-2",
  md: "m-4",
  lg: "m-6",
  xl: "m-10",
} as const;

export const marginBlock = {
  none: "my-0",
  xs: "my-1",
  sm: "my-2",
  md: "my-4",
  lg: "my-6",
  xl: "my-10",
} as const;

export const marginInline = {
  none: "mx-0",
  xs: "mx-1",
  sm: "mx-2",
  md: "mx-4",
  lg: "mx-6",
  xl: "mx-10",
} as const;

export const layoutVariants = {
  appearance,
  space,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
} as const;

export const createLayoutVariants = (baseClass: string) =>
  cva(baseClass, {
    variants: layoutVariants,
  });
