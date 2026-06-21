// src/lib/mediaProbe/server/registry.ts
//
// probe エンジンのレジストリ。フォーク側は任意のエンジンを登録・既定化できる。
// 既定エンジンの登録はライブラリのエントリ（index.ts）で行う。

import type { ProbeEngine } from "./engine/types";

const engines = new Map<string, ProbeEngine>();
let defaultName: string | null = null;

/**
 * エンジンを登録する。
 * makeDefault が true、または既定が未設定の場合はこのエンジンを既定にする。
 */
export function registerProbeEngine(engine: ProbeEngine, opts?: { makeDefault?: boolean }): void {
  engines.set(engine.name, engine);
  if (opts?.makeDefault || defaultName === null) {
    defaultName = engine.name;
  }
}

/** 既定エンジンを名前で切り替える。 */
export function setDefaultProbeEngine(name: string): void {
  if (!engines.has(name)) {
    throw new Error(`未登録の probe エンジンです: ${name}`);
  }
  defaultName = name;
}

/**
 * エンジンを解決する。
 * - ProbeEngine 実体をそのまま渡せる（その場登録不要）
 * - 名前を渡せば登録済みから引く
 * - 省略時は既定エンジン
 */
export function getProbeEngine(ref?: ProbeEngine | string): ProbeEngine {
  if (ref && typeof ref !== "string") return ref;
  const name = ref ?? defaultName;
  if (!name) {
    throw new Error(
      "probe エンジンが登録されていません。'@/lib/mediaProbe' をエントリとして import してください。",
    );
  }
  const engine = engines.get(name);
  if (!engine) {
    throw new Error(`未登録の probe エンジンです: ${name}`);
  }
  return engine;
}

/** 登録済みエンジン名の一覧。 */
export function listProbeEngines(): string[] {
  return [...engines.keys()];
}
