// src/featureGate/openSwitch.ts
// 全開スイッチ FEATURE_GATE_OPEN(門番の中だけが読む。外には出さない: 判定は ruleList.ts の包みを通る)。
// - 値: 未設定・空 = なし(規則の値のまま)/ "all" = 全規則を開く / "coupon,wallet" = 名前の物だけ開く(区切りは , と空白)
//   未知の名前は throw(打ち間違いを黙って閉じたままにしない。gate.enabled の未知の名前と同じ)
// - 効く条件: 開発とテスト(NODE_ENV が production でない)は全 Tier。本番のビルドは Tier1 だけ
//   Tier1 の判別 = FEATURE_GATE_TIER1(next.config.ts が build 時に fork_id から計算して inline する。fork の build では "false")
//   効かない所(fork の本番)では値を読まない(置かれていても落とさない)
// - 読み方: process.env.<名前> を字面で読む(next.config の env の inline は字面の参照だけを置き換える)
// 詳細: ./README.md

/** スイッチの答え: null = 開けない、"all" = 全部、集合 = その名前だけ */
export type OpenSwitch = null | "all" | ReadonlySet<string>;

/** スイッチに関わる env の値(テストは差し替えて渡す) */
export type OpenSwitchEnv = {
  /** FEATURE_GATE_OPEN */
  open: string | undefined;
  /** NODE_ENV */
  nodeEnv: string | undefined;
  /** FEATURE_GATE_TIER1(build 時の注入。"true" のときだけ Tier1) */
  tier1: string | undefined;
};

/** スイッチが効く環境か(開発・テストは全 Tier、本番は Tier1 だけ) */
export function isOpenSwitchActive(env: Pick<OpenSwitchEnv, "nodeEnv" | "tier1">): boolean {
  return env.nodeEnv !== "production" || env.tier1 === "true";
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

/** env の値からスイッチの答えを出す(純関数)。効かない環境では値を読まない */
export function resolveOpenSwitch(env: OpenSwitchEnv, known: ReadonlySet<string>): OpenSwitch {
  if (!isOpenSwitchActive(env)) return null;
  return parseOpenSwitch(env.open, known);
}

/** 今の env(字面の参照。FEATURE_GATE_TIER1 は build 時に inline される) */
export function currentOpenSwitchEnv(): OpenSwitchEnv {
  return {
    open: process.env.FEATURE_GATE_OPEN,
    nodeEnv: process.env.NODE_ENV,
    tier1: process.env.FEATURE_GATE_TIER1,
  };
}

let cache: { key: string; value: OpenSwitch } | null = null;

/** 今のスイッチの答え(env の値ごとに 1 回だけ読む。テストが env を差し替えれば読み直す) */
export function currentOpenSwitch(known: ReadonlySet<string>): OpenSwitch {
  const env = currentOpenSwitchEnv();
  const key = `${env.open ?? ""}\u0000${env.nodeEnv ?? ""}\u0000${env.tier1 ?? ""}`;
  if (cache?.key !== key) cache = { key, value: resolveOpenSwitch(env, known) };
  return cache.value;
}
