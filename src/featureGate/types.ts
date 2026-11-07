// src/featureGate/types.ts
// 門番(機能を閉じる仕組み)の型。外からは @/featureGate(index.ts)から読む。

import type { FeatureName } from "./extensions/rules";

export type { FeatureName };

/**
 * 機能を閉じる規則(1 機能 1 ファイル: src/featureGate/rules/<名前>.ts の `export const rule`。名前 = ファイル名 = FeatureName)。
 * enabled() が false の規則は次の 2 か所で効く:
 * - ルートゲート(src/proxies/featureGate.ts が gate.path を呼ぶ): pathPatterns に一致するページ / API を 404(redirectTo があればそこへ rewrite)
 * - スキーマゲート(pnpm db:push / db:push:check、src/featureGate/node/gatedSchema.ts): features のフォルダの表を push 対象から外す
 *   作る方向にしか働かない。false の間は作らず、既にあるテーブルも消さない(true にした次の push で作られる)
 *   表名は書かない: 生成器がフォルダの pgTable から導き(scripts/structure/registry/tableScan.mjs)、生成一覧に文字列で書く
 * 一覧は生成物 src/featureGate/extensions/rules.ts(pnpm generate extensions、ファイル名の順)。読み手はこの一覧だけを読む。
 * 住所の重なりは許す(OR)。行き先の違う重なりは、ファイル名の順で最初の無効な規則の redirectTo。詳細: src/featureGate/README.md
 */
export type FeatureGateRule = {
  /**
   * ブロック対象のパス。"/demo" = セグメント境界の前方一致("/demo-login" は含まない)、
   * "=/mypage" = そのパスちょうど(fork が同じ URL の下に足したページを巻き込まない)。照合: src/lib/pathPattern
   */
  pathPatterns: string[];
  /**
   * false の間 push 対象から外す表を持つ機能のフォルダ(src/features からの相対、例 "core/wallet"・"sample")。
   * 文字列リテラルの配列で書く(生成器が字面で読む)。フォルダの下の全 pgTable が対象(fork が上流のフォルダに足した表も入る)。
   * 書かない規則は表を外さない。enum は外さない
   */
  features?: string[];
  /** この機能が有効か(config の値を読む同期関数。入切の値の置き場は config) */
  enabled: () => boolean;
  /** ブロック時の rewrite 先(省略時: API は 404、ページは /404) */
  redirectTo?: string;
};

/**
 * 生成一覧の要素: 規則 + 生成器が付ける名前(ファイル名)と features から導いた表名・汎用 API の住所(features を書かない規則は空)。
 * domainApiPaths(/api/<features のフォルダの domainEntry のキー>)と settingPaths(/admin/settings/<この規則を feature に持つ設定の節の key>)は
 * 生成器が pathPatterns の後ろにも足す(規則に手書きしない)
 */
export type GatedFeatureRule = FeatureGateRule & { name: FeatureName; tables: string[]; domainApiPaths: string[]; settingPaths: string[] };

/**
 * 常時実行の入口の例外(1 項目 1 ファイル: src/featureGate/alwaysOnExceptions/<名前>.ts)。
 * - `export const exception`: 常に読み込まれる結線のうち、表を持つ機能のフォルダを import してよいもの
 * - `export const registry`: fork の手書きの登録表(中の名前は条件つき spread の内側で使う)
 * どちらか 1 つ、reason は必須(空は失敗)。当たらない行は失敗(縮む表)。検査: checks/featureGate.test.mjs
 */
export type AlwaysOnException = {
  /** リポジトリ直下からの相対パス */
  file: string;
  /** 閉じなくてよい理由 / 常に読まれる理由 */
  reason: string;
};

/**
 * 依存の検査の例外(1 項目 1 ファイル: src/featureGate/dependencyExceptions/<名前>.ts の `export const exception`)。
 * 閉じられる機能のフォルダを外から import してよいファイル(字面で判定できない物: 動的 import・wiring の遅延 import など)。
 * reason は必須(空は失敗)。当たらない行は失敗(縮む表)。検査: checks/dependencies.test.mjs
 */
export type DependencyException = {
  /** リポジトリ直下からの相対パス */
  file: string;
  /** 閉じられる機能を確かめずに読んでよい理由 */
  reason: string;
};

/**
 * この fork が必ず使う機能(1 機能 1 ファイル: src/featureGate/required/<機能名>.ts の `export const required`)。
 * 依存の検査は「この機能のフォルダを外から読むこと」を依存を書いたとみなして通す。pnpm ops features list は必須と出し、pnpm ops features set は off にしない
 */
export type RequiredFeature = {
  /** 必ず使う理由 */
  reason: string;
};

/** gate.path の答え(D23): 開いているか。閉じていれば一覧の順で最初の閉じた規則の名前(rule)と行き先 */
export type GatePathResult =
  | { open: true }
  | { open: false; rule: FeatureName; redirectTo?: string };

/** 閉じた住所の 1 項目(閉じた規則の pathPatterns の 1 つと、その規則の名前・行き先)。並びの順 = 一覧の順 → 規則の中の pathPatterns の順 */
export type ClosedPathEntry = { pattern: string; rule: FeatureName; redirectTo?: string };

/**
 * client に渡す範囲(枠)。user = 利用者の枠(/admin と /api の下を除く住所)、admin = 管理の枠(user + /admin の下)。
 * /api の下はどちらの範囲にも入らない(リンクの先にならない)
 */
export type ClientGateArea = "user" | "admin";

/** server が計算して client に渡す値(clientGateState)。client は規則を評価せずこれだけを読む */
export type ClientGateState = {
  area: ClientGateArea;
  /** { 規則名: 開閉 }(全規則) */
  enabled: Record<FeatureName, boolean>;
  /** 範囲の中の閉じた住所の並び */
  closed: ClosedPathEntry[];
};

/** client の useGate().path の答え。rule: null = 範囲の外・Provider の外(本番だけ。dev は throw)で閉とみなした */
export type ClientGatePathResult = GatePathResult | { open: false; rule: null };
