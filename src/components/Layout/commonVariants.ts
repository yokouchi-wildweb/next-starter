import { cva } from "class-variance-authority";
import { appearance } from "./appearance";
export { appearance } from "./appearance";

export const padding = {
  none: "p-0",
  xs: "p-1",
  sm: "p-2",
  md: "p-3 sm:p-4",
  lg: "p-4 sm:p-6",
  xl: "p-6 sm:p-10",
  xxl: "p-10 sm:p-16",
  xxxl: "p-16 sm:p-24",
} as const;

export const paddingBlock = {
  none: "py-0",
  xs: "py-1",
  sm: "py-2",
  md: "py-3 sm:py-4",
  lg: "py-4 sm:py-6",
  xl: "py-6 sm:py-10",
  xxl: "py-10 sm:py-16",
  xxxl: "py-16 sm:py-24",
} as const;

export const paddingInline = {
  none: "px-0",
  xs: "px-1",
  sm: "px-2",
  md: "px-3 sm:px-4",
  lg: "px-4 sm:px-6",
  xl: "px-6 sm:px-10",
  xxl: "px-10 sm:px-16",
  xxxl: "px-16 sm:px-24",
} as const;

export const margin = {
  none: "m-0",
  xs: "m-1",
  sm: "m-2",
  md: "m-4",
  lg: "m-6",
  xl: "m-10",
  xxl: "m-16",
  xxxl: "m-24",
} as const;

export const marginBlock = {
  none: "my-0",
  xs: "my-1",
  sm: "my-2",
  md: "my-4",
  lg: "my-6",
  xl: "my-10",
  xxl: "my-16",
  xxxl: "my-24",
} as const;

export const marginInline = {
  none: "mx-0",
  xs: "mx-1",
  sm: "mx-2",
  md: "mx-4",
  lg: "mx-6",
  xl: "mx-10",
  xxl: "mx-16",
  xxxl: "mx-24",
} as const;

export const layoutVariants = {
  appearance,
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
