// src/featureGate/openSwitch.ts
// 全開スイッチ FEATURE_GATE_OPEN(門番の中だけが読む。外には出さない: 判定は ruleList.ts の包みを通る)。
// - 値: 未設定・空 = なし(規則の値のまま)/ "all" = 全規則を開く / "coupon,wallet" = 名前の物だけ開く(区切りは , と空白)
//   未知の名前は throw(打ち間違いを黙って閉じたままにしない。gate.enabled の未知の名前と同じ)
// - 効く条件: 段階(@/lib/appEnv の getAppEnv、APP_ENV)が development なら全 Tier。staging・production(値なし・知らない値も)は Tier1 だけ
//   効かない所(fork の本番など)では値を読まない(置かれていても落とさない)
// - Tier1 の判別は isTier1Build の 1 つ: next の build では next.config.ts が fork_id から計算して inline した FEATURE_GATE_TIER1、
//   注入の無い node(scripts・テスト)では node.ts が渡す読み手(node/tier1.ts = readForkIdentity().isTier1)。どちらも無ければ Tier1 でない
//   このファイルは proxy(Edge)と server の束に載るので node: を引き込まない(読み手は node の入口から渡す。pnpm test src/featureGate/checks/reachability.test.mjs)
// 詳細: ./README.md

import { getAppEnv, type AppEnv } from "@/lib/appEnv";

/** スイッチの答え: null = 開けない、"all" = 全部、集合 = その名前だけ */
export type OpenSwitch = null | "all" | ReadonlySet<string>;

/** スイッチに関わる値(テストは差し替えて渡す) */
export type OpenSwitchEnv = {
  /** FEATURE_GATE_OPEN */
  open: string | undefined;
  /** 段階(getAppEnv) */
  appEnv: AppEnv;
  /** Tier1 のビルドか(isTier1Build) */
  tier1: boolean;
};

let nodeTier1Reader: (() => boolean) | null = null;

/** 注入の無い node で Tier1 を判別する読み手を渡す(node/tier1.ts だけが呼ぶ) */
export function setNodeTier1Reader(reader: () => boolean): void {
  nodeTier1Reader = reader;
}

/**
 * Tier1 のビルドか。FEATURE_GATE_TIER1 は字面で読む(next.config の env の inline は字面の参照だけを置き換える)。
 * 注入が無い(node の scripts・テスト)ときだけ node の入口が渡した読み手に聞く。読み手も無ければ false
 */
export function isTier1Build(): boolean {
  const injected = process.env.FEATURE_GATE_TIER1;
  if (injected === "true") return true;
  if (injected === "false") return false;
  return nodeTier1Reader?.() ?? false;
}

/** スイッチが効く段階か(development は全 Tier、他は Tier1 だけ) */
export function isOpenSwitchActive(env: Pick<OpenSwitchEnv, "appEnv" | "tier1">): boolean {
  return env.appEnv === "development" || env.tier1;
}

/** 値を読む(純関数)。known = 規則の名前の全部。未知の名前は throw */
export function parseOpenSwitch(raw: string | undefined, known: ReadonlySet<string>): OpenSwitch {
  const value = raw?.trim() ?? "";
  if (value === "") return null;
  if (value === "all") return "all";
  const names = value.split(/[\s,]+/).filter((name) => name !== "");
  const unknown = names.filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `featureGate: FEATURE_GATE_OPEN に未知の機能の名前 ${unknown.map((name) => `"${name}"`).join(", ")}(all か src/featureGate/rules/<名前>.ts の名前の並び)`,
    );
  }
  return new Set(names);
}

/** 値からスイッチの答えを出す(純関数)。効かない段階では値を読まない */
export function resolveOpenSwitch(env: OpenSwitchEnv, known: ReadonlySet<string>): OpenSwitch {
  if (!isOpenSwitchActive(env)) return null;
  return parseOpenSwitch(env.open, known);
}

/** 今の値 */
export function currentOpenSwitchEnv(): OpenSwitchEnv {
  return { open: process.env.FEATURE_GATE_OPEN, appEnv: getAppEnv(), tier1: isTier1Build() };
}

let cache: { key: string; value: OpenSwitch } | null = null;

/** 今のスイッチの答え(値ごとに 1 回だけ読む。テストが env を差し替えれば読み直す) */
export function currentOpenSwitch(known: ReadonlySet<string>): OpenSwitch {
  const env = currentOpenSwitchEnv();
  const key = `${env.open ?? ""}\u0000${env.appEnv}\u0000${env.tier1}`;
  if (cache?.key !== key) cache = { key, value: resolveOpenSwitch(env, known) };
  return cache.value;
}
