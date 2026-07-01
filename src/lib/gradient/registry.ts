// src/lib/gradient/registry.ts
// グラデーショントークンの実行時レジストリ（単一ソース）。
//
// 構成:
//   BASE_GRADIENTS（upstream）＋ customGradients（downstream config）を起動時にマージ。
//   registerGradients() で実行時の動的追加も可能（同一キーは後勝ちで上書き）。
//
// 純粋TS（Reactに依存しない）。codegen スクリプトからも import される。

import { customGradients } from "@/config/app/gradients.config";

import { toGradientToken } from "./build";
import { BASE_GRADIENTS } from "./tokens.base";
import type { GradientToken, GradientTokenInput } from "./types";

/** key -> 登録形トークン。後勝ちで上書き（downstream が base を上書き可能）。 */
const registry = new Map<string, GradientTokenInput>();

function seed(tokens: GradientTokenInput[]): void {
  for (const token of tokens) {
    registry.set(token.key, token);
  }
}

// 起動時シード: base → custom の順（custom が同キーを上書き）
seed(BASE_GRADIENTS);
seed(customGradients);

/**
 * グラデーショントークンを実行時に登録（追加・上書き）する。
 * 静的な拡張は src/config/app/gradients.config.ts を推奨。
 * 本APIは動的生成など特殊用途向け。
 */
export function registerGradients(tokens: GradientTokenInput[]): void {
  seed(tokens);
}

/**
 * 登録済みトークンを「登録形」のまま列挙する（codegen 用。darkStops / text を含む）。
 */
export function listGradientInputs(): GradientTokenInput[] {
  return [...registry.values()];
}

/**
 * 登録済みトークンを「確定形（cssValue 付き）」で列挙する。
 * ピッカーの選択肢生成等に使う。
 */
export function listGradients(): GradientToken[] {
  return [...registry.values()].map(toGradientToken);
}

/**
 * キー指定でトークンを取得する。未登録なら null。
 */
export function getGradient(key: string): GradientToken | null {
  const token = registry.get(key);
  return token ? toGradientToken(token) : null;
}
