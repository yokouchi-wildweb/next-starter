import { cva } from "class-variance-authority";

export const appearance = {
  surface:
    "bg-white text-slate-900 shadow-none ring-1 ring-slate-200/60 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700/60",
  raised:
      "bg-white text-slate-900 shadow-[0_20px_60px_-15px_rgba(30,64,175,0.3)] ring-1 ring-blue-500/10 dark:bg-slate-900 dark:text-slate-100 dark:ring-blue-300/10 dark:shadow-[0_20px_60px_-15px_rgba(96,165,250,0.45)]",
  outlined:
    "bg-white/95 text-slate-900 ring-1 ring-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:bg-slate-900/80 dark:text-slate-100 dark:ring-slate-700 dark:shadow-[0_1px_2px_rgba(15,23,42,0.65)]",
  frosted:
      "bg-slate-100/70 text-slate-900 backdrop-blur-2xl ring-1 ring-white/60 shadow-[0_25px_55px_-20px_rgba(150,180,233,0.35)] dark:bg-slate-800/40 dark:text-slate-100 dark:ring-cyan-200/10 dark:shadow-[0_25px_55px_-20px_rgba(14,165,233,0.5)]",
  soft:
    "bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 ring-1 ring-slate-200/70 shadow-[0_12px_35px_-20px_rgba(15,23,42,0.35)] dark:from-slate-900 dark:via-slate-900/70 dark:to-slate-900/40 dark:text-slate-100 dark:ring-slate-700/70 dark:shadow-[0_12px_35px_-18px_rgba(15,23,42,0.55)]",
  radiant:
    "bg-gradient-to-r from-cyan-50 via-white to-emerald-50 text-slate-900 ring-1 ring-cyan-500/25 shadow-[0_25px_50px_-20px_rgba(14,165,233,0.4)] dark:from-slate-900 dark:via-slate-900/60 dark:to-slate-900/30 dark:text-slate-100 dark:ring-cyan-400/30 dark:shadow-[0_25px_50px_-20px_rgba(14,165,233,0.55)]",
} as const;

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
