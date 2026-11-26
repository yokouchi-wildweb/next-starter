// src/lib/startup/extensionPoints.ts
// 起動時の処理(lib)の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 一覧と結び目は生成物 src/wiring/startup.ts(pnpm generate extensions、D30・D31)。lib は一覧を読まない

export const extensionPoints = {
  // 起動時の処理: 差す側の <ドメイン>/plugs/startupTasks/<名前>.ts(lib は <lib>/plugs/…)の export const task。
  // サーバーの起動ごとに 1 回(src/instrumentation.ts の register)。起動のときだけ読む(lazy)。上流の項目は 0
  startupTasks: {
    change: "add",
    plugs: true,
    export: "task",
    type: { from: "@/lib/startup/points", name: "StartupTask" },
    side: "server",
    load: "lazy",
    target: "wiring",
    // runtime が nodejs の項目(既定)は NEXT_RUNTIME が nodejs の時だけ読む(edge の instrumentation の束に入れない)
    runtimeGuard: true,
  },
};

// 結び目: src/wiring/startup.ts の startup = wireStartup({ startupTasks: 門番で絞った一覧 })
export const wire = { name: "wireStartup", export: "startup", side: "server" };
