// src/lib/domain/fields/idField.ts

/**
 * 主キーの論理名。createCrudService は表の主キー列を常にこの名前で扱う（where の field、戻り値のキー）。
 * 物理名は Drizzle 版サービスの getIdColumnName() で引く（serviceRegistry の DomainService 経由でも同じ）。
 */
export const CRUD_ID_FIELD = "id" as const;
