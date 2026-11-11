// src/lib/globalLoader/spinner.ts
//
// スピナーの種類 → lucide のアイコン。棚の Overlays/Loading/Spinner と同じ対応(lib は棚を読まない: D103)。
// 見た目が棚とずれないことは src/components/Overlays/Loading/globalLoaderParity.test.tsx が確かめる。

import { Loader2Icon, LoaderCircleIcon, LoaderIcon, type LucideIcon } from "lucide-react";

export const LOADER_SPINNER_ICONS = {
  default: Loader2Icon,
  ring: LoaderIcon,
  circle: LoaderCircleIcon,
} satisfies Record<string, LucideIcon>;

/** スピナーの種類(棚の SpinnerVariant と同じ値) */
export type LoaderSpinnerVariant = keyof typeof LOADER_SPINNER_ICONS;
