// src/lib/routeFactory/extensionPoints.ts
// API ルートの Factory(lib)の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 一覧は生成物 src/wiring/routeFactory.ts(pnpm generate extensions、D31)。結ぶのは src/wiring/apiRoute.ts(一覧を門番で絞り、型は <点>Map から取り出す)。lib は一覧を読まない。
// 約束の型と取り出しの型: ./plugs.ts。どの点も shape "object"(<点>Map が項目ごとの具体の型を残す)

export const extensionPoints = {
  // 利用者の解き方: 差す側の <ドメイン>/plugs/routeFactoryUser/<名前>.ts の export const plug({ deps: RouteUserDeps })。
  // ちょうど 1 つ(required、D53): 上流は常設の auth が 1 行スイッチの既定を差し、fork は auth の差替点で <名前>.replace.ts に替える(2 つ目を足さない)
  routeFactoryUser: {
    change: "add",
    plugs: true,
    export: "plug",
    type: { from: "@/lib/routeFactory/points", name: "AnyRouteUserPlug" },
    side: "server",
    shape: "object",
    max: 1,
    required: true,
    target: "wiring",
  },
  // 登録端末: 差す側の <ドメイン>/plugs/routeFactoryDevice/<名前>.ts の export const plug({ deps: RouteDeviceDeps, types? })。
  // 0〜1 個(D53): 上流は閉じられる pairedDevice が差す。空(閉じて外された)なら lib の「端末なし」(端末だけのルートは 401、orUser は利用者の枝)
  routeFactoryDevice: {
    change: "add",
    plugs: true,
    export: "plug",
    type: { from: "@/lib/routeFactory/points", name: "AnyRouteDevicePlug" },
    side: "server",
    shape: "object",
    max: 1,
    target: "wiring",
  },
  // レート制限: 差す側の <ドメイン>/plugs/routeFactoryRateLimit/<名前>.ts の export const plug({ deps: RouteRateLimitDeps })。
  // ちょうど 1 つ(required、D53): 上流は常設の rateLimit が 1 行スイッチの既定を差し、fork は rateLimit の差替点で替える
  routeFactoryRateLimit: {
    change: "add",
    plugs: true,
    export: "plug",
    type: { from: "@/lib/routeFactory/points", name: "AnyRouteRateLimitPlug" },
    side: "server",
    shape: "object",
    max: 1,
    required: true,
    target: "wiring",
  },
  // メンテナンスの判定: 差す側の <ドメイン>/plugs/routeFactoryMaintenance/<名前>.ts の export const plug({ deps: RouteMaintenanceDeps })。
  // 0〜1 個: 上流は setting が差す。空ならメンテナンスで止めない(lib の既定)。判定は proxy の項目 setting/plugs/proxyHandlers/maintenance と同じ持ち主
  routeFactoryMaintenance: {
    change: "add",
    plugs: true,
    export: "plug",
    type: { from: "@/lib/routeFactory/points", name: "AnyRouteMaintenancePlug" },
    side: "server",
    shape: "object",
    max: 1,
    target: "wiring",
  },
};
