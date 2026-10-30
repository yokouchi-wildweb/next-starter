// eslint-rules/import-boundaries.exceptions.mjs
//
// import-boundaries の lib-no-registry(src/lib/** → src/registry/** の禁止)の、今ある違反の一覧。
// 縮むだけの一覧: 行を足さない。直した出荷でその行を消す(違反しなくなった行が残っていても error になる)。
// upstream の物で、fork は足せない(このファイルは fork の受け口に無い。fork の lib は wiring 経由で登録表を受ける)。
// 直し方: lib の関数は登録表を引数・注入で受け、結ぶのは src/wiring/**(src/wiring/README.md)。

/** @type {readonly { file: string, target: string, reason: string }[]} */
export const LIB_REGISTRY_EXCEPTIONS = [
  { file: "src/lib/drizzle/index.ts", target: "src/registry/schemaRegistry", reason: "DB クライアントに全表を渡す" },
  { file: "src/lib/domain/junction/getTable.ts", target: "src/registry/schemaRegistry", reason: "中間表の名前 → 表(getJunctionTable の引数化で消す)" },
  { file: "src/lib/domain/config/getDomainConfig.ts", target: "src/registry/domainConfigRegistry", reason: "ドメイン名 → domain.json(表示用の写しで消す)" },
];
