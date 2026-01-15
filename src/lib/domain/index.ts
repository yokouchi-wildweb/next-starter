// 順序重要: getDomainConfig は serviceRegistry に依存しないため最初にエクスポート
// getService/getDomainList は serviceRegistry をインポートするため後にエクスポート
export * from "./getDomainConfig";
export * from "./getService";
export * from "./getDomainList";
