// src/domains/core/admin/menu/byKey.ts
// plugs の点の一覧(項目 { domain, name, requires, plug })を項目の key の表にする(null プロトタイプ。外から来た名前で引いても constructor などに当たらない)。
// 門番で閉じたドメインの項目を外すのは呼び手(gate.plugs / useGate().plugs)。表は絞った後に作る(段 3 注文 25: 絞る前の表は閉じた項目を残す)

export function byKey<T extends { key: string }>(entries: readonly { plug: T }[]): Readonly<Record<string, T>> {
  return Object.assign(Object.create(null), Object.fromEntries(entries.map((entry) => [entry.plug.key, entry.plug])));
}
