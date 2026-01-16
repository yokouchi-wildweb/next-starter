// src/lib/domain/relations/index.ts
// リレーションユーティリティのエントリーポイント

// 汎用ユーティリティ
export * from "./utils";

// リレーションタイプ別
export * from "./getBelongsToRelations";
export * from "./getBelongsToManyRelations";
export * from "./getHasManyRelations";
