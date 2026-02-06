// src/features/auth/entities/index.ts

// NOTE:
// セッション関連のエンティティ（./session）はユーザーエンティティを参照しており、
// その過程で Node.js 向けモジュール（crypto など）を利用するユーティリティを読み込む。
// クライアントサイドから本ファイル経由でスキーマのみを読み込みたいケースが大半のため、
// ここでは schema のみを再エクスポートし、session とは分離する。
export * from "./schema";
export * from "./phoneVerification";
