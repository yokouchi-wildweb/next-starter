// src/lib/crud/index.ts
// crud の入口 ".": 画面側(hooks・CRUD ボタンと一括操作の作成関数・HTTP の client・一覧の列・型)。
// client でも server でも読める(server からは型だけを読む)。保存側のサービスは入口 "./server"。
// 差し込み口: setApiErrorHandler(HTTP の失敗の扱い)・registerCrudEventHandler(CRUD の出来事の通知)

export * from "./client";
export * from "./hooks";
export { revalidateRelatedCaches } from "./hooks/revalidateRelatedCaches";
export * from "./components";
export * from "./presenters";
export * from "./types";
export * from "./orderBy";
