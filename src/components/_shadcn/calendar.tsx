// src/components/_shadcn/calendar.tsx
//
// shadcn/ui 準拠の Calendar 素体（react-day-picker v9）。
// プロジェクト専用の挙動は src/components/Overlays/Calendar/Calendar.tsx で上書きする。

"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";

import { cn } from "@/lib/cn";
import { baseButtonClassName } from "@/components/_shadcn/button";

export type CalendarProps = DayPickerProps;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      data-slot="calendar"
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: cn(
          baseButtonClassName,
          "size-7 bg-transparent p-0 hover:bg-accent hover:text-accent-foreground absolute left-1 top-1",
        ),
        button_next: cn(
          baseButtonClassName,
          "size-7 bg-transparent p-0 hover:bg-accent hover:text-accent-foreground absolute right-1 top-1",
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent/50",
        day_button: cn(
          baseButtonClassName,
          "size-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground",
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground rounded-md",
        outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("size-4", chevronClassName)} />;
          }
          return <ChevronRight className={cn("size-4", chevronClassName)} />;
        },
        ...components,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
