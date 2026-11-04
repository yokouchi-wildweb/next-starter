// src/featureGate/hiddenHref.ts
// 「この href を隠すか」の判定の純関数(規則を読まない)。server の道具(gate.filter)と、後の client の道具・リンクが同じ判定を使う。
// - 隠すのは '/' で始まる内部の住所('//' で始まる別オリジンは対象外)だけ。? と # の後ろは照合から外す
// - 閉じた住所の並びの順で最初に当たった項目に redirectTo が無ければ隠す(行き先のある閉は行き先の画面があるので出したまま)
// - server は evaluate.ts が今の閉じた規則から並びを作って呼ぶ。client は server から受け取った並びで呼ぶ(client は規則を評価しない)

import { matchesPath } from "@/lib/pathPattern/index.mjs";

/** 閉じた住所の 1 項目(閉じた規則の pathPatterns の 1 つと、その規則の行き先) */
export type ClosedPathEntry = { pattern: string; redirectTo?: string };

/** 照合に使う pathname(内部の住所でなければ null) */
export function internalPathname(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const end = href.search(/[?#]/);
  return end === -1 ? href : href.slice(0, end);
}

/** href を隠すか: 内部の住所で、並びの順で最初に当たった閉じた住所に redirectTo が無い */
export function isHiddenHref(href: string, closed: readonly ClosedPathEntry[]): boolean {
  const pathname = internalPathname(href);
  if (pathname === null) return false;
  const hit = closed.find((entry) => matchesPath(pathname, entry.pattern));
  return hit !== undefined && hit.redirectTo === undefined;
}
