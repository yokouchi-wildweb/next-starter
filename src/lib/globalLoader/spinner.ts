// src/lib/globalLoader/spinner.ts
//
// スピナーの種類。棚の Overlays/Loading/Spinner の SpinnerVariant をそのまま使う(描画も棚の ScreenLoader、当議会 D208)。

import type { SpinnerVariant } from "@/components/Overlays/Loading";

/** スピナーの種類(棚の SpinnerVariant と同じ) */
export type LoaderSpinnerVariant = SpinnerVariant;
