// src/lib/backends/none.ts
// 組み込みの none の項目(D29): 選択表で "none"(使わない)にした口の代わり。呼べば未設定の基底の子を投げる

import { BackendNotConfiguredError } from "@/lib/errors";

import { NONE_IMPLEMENTATION } from "./reserved";
import type { BackendAdapter } from "./types";

/** none を選んだ口の操作を呼んだときの誤り(port = 口、implementation "none"、missing は空) */
export class BackendNoneSelectedError extends BackendNotConfiguredError {
  constructor(port: string, side: "client" | "server" = "server") {
    super(
      `口 "${port}" は backend-selection.json で "none"(使わない)です。使うなら実装の名前を選んでください。`,
      { port, implementation: NONE_IMPLEMENTATION, missing: [], side },
    );
    this.name = "BackendNoneSelectedError";
  }
}

export type CreateNoneAdapterOptions = {
  /** 誤りの side(既定 "server") */
  side?: "client" | "server";
};

/**
 * none の adapter を作る。isConfigured は { configured: false, missing: [] }、それ以外のどの操作も
 * 呼べば BackendNoneSelectedError を投げる(口の操作の型 A をそのまま満たす)
 */
export function createNoneAdapter<A extends BackendAdapter>(port: string, options: CreateNoneAdapterOptions = {}): A {
  const side = options.side ?? "server";
  return new Proxy({} as A, {
    get(_target, prop) {
      if (prop === "isConfigured") return () => ({ configured: false, missing: [] });
      // `await adapter` / ログ出力などで暗黙に参照されるキーは素通しする
      if (prop === "then" || typeof prop === "symbol") return undefined;
      return () => {
        throw new BackendNoneSelectedError(port, side);
      };
    },
  });
}
