// src/featureGate/types.ts
// 門番(機能を閉じる仕組み)の型。外からは @/featureGate(index.ts)から読む。

import type { FeatureName } from "./extensions/rules";

export type { FeatureName };

/**
 * 機能を閉じる規則(1 機能 1 ファイル: src/featureGate/rules/<名前>.ts の `export const rule`。名前 = ファイル名 = FeatureName)。
 * enabled() が false の規則は次の 2 か所で効く:
 * - ルートゲート(src/proxies/featureGate.ts が gate.path を呼ぶ): pathPatterns に一致するページ / API を 404(redirectTo があればそこへ rewrite)
 * - スキーマゲート(pnpm db:push / db:push:check、src/featureGate/node/gatedSchema.ts): 閉じたドメイン(domains のフォルダ、持つ機能が全部閉)の表を push 対象から外す
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
   * この機能が使うドメインのフォルダ(src/features からの相対、例 "core/wallet"・"sample")。D33 で features: から改名(古い名前は生成器が止める)。
   * 文字列リテラルの配列で書く(生成器が字面で読む)。ドメインは持つ機能のどれかが開なら開(D24)、閉なら表・汎用 API・cron が閉じる。
   * フォルダの下の全 pgTable が対象(fork が上流のフォルダに足した表も入る)。1 つのドメインを複数の機能に書いてよい。enum は外さない
   */
  domains?: string[];
  /**
   * この機能が使う機能(機能の名前 = 規則のファイル名の並び、全部 AND)。機能が開く = 自分が開 && 依存先が全部開(推移的)。
   * 文字列リテラルの配列で書く(生成器が字面で読み、未知の名前・自分・重複・輪を止める)。評価は ruleList.ts の 1 か所
   */
  dependsOn?: FeatureName[];
  /**
   * どれか 1 つが開いていれば開く機能の並び(OR、D36)。dependsOn と両方あれば両方を満たすとき開。文字列リテラルの配列で書く(生成器が未知・自分・重複・輪を止める)。
   * 例: その他の操作(休会・退会の入口)は休会か退会のどちらかが開なら開
   */
  anyOf?: FeatureName[];
  /**
   * 入切の上流の既定(必須、true か false のリテラル。設定 D103)。fork の値は src/config/featureGate/switches.config.ts(上流は空で出荷)が上書きする(D35)。
   * 自分の値 = (switches の値 ?? defaultEnabled) && enabled()。合成は ruleList.ts の 1 か所。pnpm ops features set が書く(fork = switches、Tier1 = ここ)
   */
  defaultEnabled: boolean;
  /**
   * 入切でない開く条件(config の値から導いた値を読む同期関数。例 銀行振込の方法が選べるか)。省略 = 条件なし。
   * 入切そのもの(人が開け閉めする値)は defaultEnabled と switches.config.ts に置き、ここに書かない
   */
  enabled?: () => boolean;
  /** ブロック時の rewrite 先(省略時: API は 404、ページは /404) */
  redirectTo?: string;
};

/**
 * 生成一覧の要素(src/featureGate/extensions/rules.ts。門番の中で値で読むのは ruleList.ts だけ): 規則 + 生成器が付ける名前(ファイル名)と domains から導いた表名・汎用 API の住所(domains を書かない規則は空)。
 * tables・domainApiPaths(/api/<domains のフォルダの domainEntry のキー>)・settingPaths(/admin/settings/<この規則を feature に持つ設定の節の key>)・
 * cronPaths(/api/cron/<domains のフォルダを値で import する cron の task の名前>)は説明用(pnpm ops features list)で pathPatterns に足さない:
 * 表・汎用 API・cron はドメインに、設定の節の住所は節に付き、開閉は GatedDomain・GatedCronTask・GatedSettingSection で決まる(D34 K4)
 */
export type GeneratedFeatureRule = FeatureGateRule & {
  name: FeatureName;
  tables: string[];
  domainApiPaths: string[];
  settingPaths: string[];
  cronPaths: string[];
  /** 規則の dependsOn(書かない規則は空)。生成器が字面から写す */
  dependsOn: FeatureName[];
  /** 規則の anyOf(書かない規則は空)。生成器が字面から写す */
  anyOf: FeatureName[];
};

/**
 * どれかの規則の domains に載るドメイン(生成一覧の domains)。開 = features(持つ機能の名前)のどれかが開(D24)。どの規則にも載らないドメインは載らず常に開。
 * 表(db:push・seed・pnpm ops db clear)と汎用 API の住所(apiPaths = /api/<domainEntry のキー>)はこの開閉で決まる
 */
export type GatedDomain = {
  /** src/features からの相対("core/wallet"・"sample") */
  folder: string;
  tables: string[];
  apiPaths: string[];
  /** このドメインを domains に持つ機能の名前(一覧の順) */
  features: FeatureName[];
};

/** domains のドメインを値で import する cron の task(生成一覧の cronTasks)。開 = 読むドメイン(folders)が全部開。載らない task は常に開 */
export type GatedCronTask = {
  /** /api/cron/<名> */
  path: string;
  /** 読むドメインのフォルダ(domains の folder) */
  folders: string[];
};

/** 機能を名指す設定の節(生成一覧の settingSections、節の feature から)。開 = 名指す機能(features)が全部開。名指さない節は載らず常に開 */
export type GatedSettingSection = {
  /** /admin/settings/<key> */
  path: string;
  features: FeatureName[];
};

/**
 * 判定の一覧の要素(ruleList.ts の rules / configRules): 生成一覧の要素の enabled を、依存先まで解いた開閉に差し替えた物。
 * enabled() = (全開スイッチ || 規則の enabled()、省略は開) && 依存先が全部開(推移的。configRules はスイッチを通さない)
 */
export type GatedFeatureRule = Omit<GeneratedFeatureRule, "enabled"> & { enabled: () => boolean };

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

/** 機能の入切の fork の値(src/config/featureGate/switches.config.ts の default export。機能の名前 → 開閉。書かない名前は規則の defaultEnabled) */
export type FeatureSwitches = Partial<Record<FeatureName, boolean>>;

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
