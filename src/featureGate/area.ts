// src/featureGate/area.ts
// client に渡す範囲(枠)の判定の純関数(規則を読まない)。server の clientGateState(範囲で絞る)と client の道具(範囲の外を知る)が共有する。
// - /api の下はどの枠にも入らない(リンクの先にならない)
// - /admin の下は管理の枠(admin)だけ。それ以外は利用者の枠(user)と管理の枠の両方

import { matchesPath } from "@/lib/pathPattern/index.mjs";

import type { ClientGateArea } from "./types";

const ADMIN = "/admin";
const API = "/api";

/** 住所(pathname)が枠の中か */
export function isInArea(pathname: string, area: ClientGateArea): boolean {
  if (matchesPath(pathname, API)) return false;
  if (matchesPath(pathname, ADMIN)) return area === "admin";
  return true;
}

/** 規則の住所のパターン('=' 付きも)が枠の中か */
export const isPatternInArea = (pattern: string, area: ClientGateArea): boolean =>
  isInArea(pattern.replace(/^=/, ""), area);
