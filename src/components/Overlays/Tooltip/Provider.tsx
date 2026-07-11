// src/components/Overlays/Tooltip/Provider.tsx

"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

// 共有Provider配下かどうかを子のTooltipへ伝えるフラグ
const SharedTooltipContext = React.createContext(false);

/** Tooltip が共有 TooltipProvider の配下にあるかを返す（Tooltip 内部用） */
export function useIsInsideTooltipProvider(): boolean {
  return React.useContext(SharedTooltipContext);
}

export type TooltipProviderProps = {
  /** 表示までの遅延（ms） */
  delayDuration?: number;
  /** 直前のツールチップが閉じてからこの時間内は遅延なしで次を表示（ms） */
  skipDelayDuration?: number;
  children: React.ReactNode;
};

/**
 * アプリ共通のツールチッププロバイダー
 *
 * Radix の skipDelayDuration（隣接ツールチップ間の遅延スキップ）は
 * Provider 単位でしか機能しないため、アプリルート（layout.tsx）に
 * 1つだけ配置して全 Tooltip で共有する。
 *
 * 配下の Tooltip は自前の Provider を持たず、このプロバイダーに参加する。
 * ただし Tooltip に skipDelayDuration が明示指定された場合は従来どおり
 * 個別 Provider にフォールバックする（後方互換）。
 */
export function TooltipProvider({
  delayDuration = 200,
  skipDelayDuration = 300,
  children,
}: TooltipProviderProps) {
  return (
    <SharedTooltipContext.Provider value={true}>
      <TooltipPrimitive.Provider
        delayDuration={delayDuration}
        skipDelayDuration={skipDelayDuration}
      >
        {children}
      </TooltipPrimitive.Provider>
    </SharedTooltipContext.Provider>
  );
}

export default TooltipProvider;
