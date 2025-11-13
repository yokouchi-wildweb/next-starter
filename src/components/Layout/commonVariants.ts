import { cva } from "class-variance-authority";
import { appearance } from "./appearance";

export const space = {
  none: "space-y-0",
  xs: "space-y-2",
  sm: "space-y-4",
  md: "space-y-6",
  lg: "space-y-8",
  xl: "space-y-10",
} as const;

export const padding = {
  none: "p-0",
  sx: "p-1",
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
  xl: "p-6",
} as const;

export const paddingBlock = {
  none: "py-0",
  sx: "py-1",
  sm: "py-2",
  md: "py-3",
  lg: "py-4",
  xl: "py-6",
} as const;

export const paddingInline = {
  none: "px-0",
  sx: "px-1",
  sm: "px-2",
  md: "px-3",
  lg: "px-4",
  xl: "px-6",
} as const;

export const margin = {
  none: "m-0",
  sx: "m-1",
  sm: "m-2",
  md: "m-3",
  lg: "m-4",
  xl: "m-6",
} as const;

export const marginBlock = {
  none: "my-0",
  sx: "my-1",
  sm: "my-2",
  md: "my-3",
  lg: "my-4",
  xl: "my-6",
} as const;

export const marginInline = {
  none: "mx-0",
  sx: "mx-1",
  sm: "mx-2",
  md: "mx-3",
  lg: "mx-4",
  xl: "mx-6",
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
