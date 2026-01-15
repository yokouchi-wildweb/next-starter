// 順序重要: server-only に依存しないモジュールを最初にエクスポート
// server-only を含むモジュールは後にエクスポート

// --- Client/Server 共用（server-only なし） ---
export * from "./getDomainConfig";
export * from "./junctionUtils";
export * from "./getRelations";

// --- Server Only ---
export * from "./getService";
export * from "./getDomainList";
export * from "./getJunctionTable";
