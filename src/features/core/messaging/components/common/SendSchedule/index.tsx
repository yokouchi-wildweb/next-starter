// src/features/core/messaging/components/common/SendSchedule/index.tsx
// 部品(props だけ): 送るモーダルの送る時刻(今 / 予約)。予約の粒度の注記(cron の周期、Vercel Hobby は 1 日 1 回)と誤り

"use client";

import { DatetimeInput, RadioGroupInput } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

export type SendScheduleProps = {
  mode: "now" | "at";
  scheduledAt: string;
  error: string | null;
  note: string;
  onModeChange: (mode: "now" | "at") => void;
  onScheduledAtChange: (at: string) => void;
};

const OPTIONS = [
  { value: "now", label: "今送る" },
  { value: "at", label: "予約する" },
];

export function SendSchedule({ mode, scheduledAt, error, note, onModeChange, onScheduledAtChange }: SendScheduleProps) {
  return (
    <Stack space={2} data-slot="send-schedule">
      <RadioGroupInput value={mode} options={OPTIONS} onChange={(v) => onModeChange(v === "at" ? "at" : "now")} />
      {mode === "at" ? (
        <Stack space={1}>
          <DatetimeInput aria-label="予約の時刻" value={scheduledAt} outputFormat="iso" onValueChange={onScheduledAtChange} />
          <Para size="xs" tone="muted" className="my-0">
            {note}
          </Para>
          {error ? (
            <Para size="sm" tone="destructive" className="my-0">
              {error}
            </Para>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
