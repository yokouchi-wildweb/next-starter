// src/domains/core/messaging/components/common/PreferenceGroupToggle/index.tsx
// 部品(props だけ): グループまるごとの切り替え(D123。グループの行で止めるので、後からグループに入ったカテゴリーも止まる)。
// 向きはほかの好みの部品と同じ:
// - 送信チャンネルごと(channelLabel あり)= 入 = この送信チャンネルで受け取る(マス・送信チャンネルまるごとと同じ)。値は応答の channels[].kinds[].groups[].optedOut
// - すべての送信チャンネル(channelLabel なし)= 入 = 止めている(カテゴリーまるごとと同じ)。値は応答の groups[].optedOut
// 上流の既定の画面は置かない(fork がグループだけ・カテゴリーだけ・両方を組む。組み方は components/README.md)

"use client";

import { SwitchInput } from "@/components/Input/SwitchInput";

export type PreferenceGroupToggleProps = {
  /** グループの表示名(読み上げ) */
  groupLabel: string;
  /** グループまるごとの行がある(応答の optedOut) */
  stopped: boolean;
  /** 送信チャンネルの表示名。ある = 送信チャンネルごと(入 = 受け取る)/ 無い = すべての送信チャンネル(入 = 止めている) */
  channelLabel?: string;
  /** 押せなくする(変えている最中など) */
  disabled?: boolean;
  /** すべての連絡を止めている(応答の allOptedOut)。止まった状態で見せて押せなくする */
  stoppedByAll?: boolean;
  /** stop = true でグループまるごとを止める */
  onChange: (stop: boolean) => void;
  /** 見える文言(既定 送信チャンネルごと = なし / すべての送信チャンネル =「このグループをすべての通知方法で止める」) */
  label?: string;
  size?: "sm" | "md";
};

export function PreferenceGroupToggle({
  groupLabel,
  stopped,
  channelLabel,
  disabled = false,
  stoppedByAll = false,
  onChange,
  label,
  size = "sm",
}: PreferenceGroupToggleProps) {
  const isStopped = stoppedByAll || stopped;
  if (channelLabel) {
    return (
      <SwitchInput
        value={!isStopped}
        onChange={(receive) => onChange(!receive)}
        disabled={disabled || stoppedByAll}
        size={size}
        label={label}
        aria-label={`${groupLabel}を${channelLabel}で受け取る`}
      />
    );
  }
  return (
    <SwitchInput
      value={isStopped}
      onChange={(stop) => onChange(stop)}
      disabled={disabled || stoppedByAll}
      size={size}
      label={label ?? "このグループをすべての通知方法で止める"}
      aria-label={`${groupLabel}をすべての通知方法で止める`}
    />
  );
}
