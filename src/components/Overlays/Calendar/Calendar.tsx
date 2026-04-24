// src/components/Overlays/Calendar/Calendar.tsx
//
// プロジェクト用 Calendar ラッパー。
// 日本語ロケール・日本表記のキャプション・月曜始まりを既定とする。

"use client";

import { ja } from "react-day-picker/locale";
import { type ComponentProps } from "react";

import { Calendar as ShadcnCalendar } from "@/components/_shadcn/calendar";

export type CalendarProps = ComponentProps<typeof ShadcnCalendar>;

export function Calendar({
  locale = ja,
  weekStartsOn = 1,
  ...props
}: CalendarProps) {
  return <ShadcnCalendar locale={locale} weekStartsOn={weekStartsOn} {...props} />;
}

Calendar.displayName = "Calendar";
