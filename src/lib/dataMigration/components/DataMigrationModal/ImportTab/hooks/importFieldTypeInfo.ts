// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importFieldTypeInfo.ts
// インポート画面がメインドメインのチャンクと一緒に送るフィールド情報を作る

import { isCollectionFieldType } from "@/lib/domain/fields/fieldTypes.mjs";
import type { ExportField } from "../../types";

export type ImportFieldTypeInfo = {
  name: string;
  fieldType: string | undefined;
};

/**
 * 型変換に使うフィールド情報を作る。
 * 集まりの項目（mediaCollection など）は CSV/ZIP に入らず、申告するとサーバーが 400 で拒否するので送らない
 */
export function buildImportFieldTypeInfo(fields: readonly ExportField[]): ImportFieldTypeInfo[] {
  return fields
    .filter((field) => !isCollectionFieldType(field.fieldType))
    .map((field) => ({ name: field.name, fieldType: field.fieldType }));
}
