// src/lib/crud/drizzle/index.ts
// Drizzle ORM を利用した汎用的な CRUD サービスの公開エントリーポイント

export { createCrudService } from "./service";
export type { DefaultInsert } from "./service";
export * from "./query";
export type { DrizzleCrudServiceOptions, BelongsToManyRelationConfig } from "./types";
