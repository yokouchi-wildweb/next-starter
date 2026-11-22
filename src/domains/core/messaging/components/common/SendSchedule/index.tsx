// src/domains/core/messaging/components/common/SendSchedule/index.tsx
// 部品(props だけ): 送るモーダルの送る時刻(今 / 予約)。予約の粒度の注記(cron の周期、Vercel Hobby は 1 日 1 回)と誤り。
// showNow = false は「今すぐ送信」を出さず予約の時刻だけ(予約した送信の直し: 予約のまま時刻を替える)

"use client";

import { DatetimeInput } from "@/components/Input/DatetimeInput";
import { RadioGroupInput } from "@/components/Input/RadioGroupInput";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

export type SendScheduleProps = {
  mode: "now" | "at";
  scheduledAt: string;
  error: string | null;
  note: string;
  onModeChange: (mode: "now" | "at") => void;
  onScheduledAtChange: (at: string) => void;
  /** 「今すぐ送信」の選びを出すか(既定 true。false = 予約の時刻だけ、mode は "at" として描く) */
  showNow?: boolean;
};

const OPTIONS = [
  { value: "now", label: "今すぐ送信" },
  { value: "at", label: "予約する" },
];

export function SendSchedule({ mode, scheduledAt, error, note, onModeChange, onScheduledAtChange, showNow = true }: SendScheduleProps) {
  return (
    <Stack gap="xs" data-slot="send-schedule">
      {showNow ? <RadioGroupInput value={mode} options={OPTIONS} onChange={(v) => onModeChange(v === "at" ? "at" : "now")} /> : null}
      {mode === "at" || !showNow ? (
        <Stack gap="2xs">
          <DatetimeInput aria-label="予約日時" value={scheduledAt} outputFormat="iso" onValueChange={onScheduledAtChange} />
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
