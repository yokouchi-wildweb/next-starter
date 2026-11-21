// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importFieldTypeInfo.ts
// インポート画面がメインドメインのチャンクと一緒に送るフィールド情報を作る

import { isCollectionFieldType } from "@/lib/domain";
import type { DomainField } from "@/lib/domain";
import type { ExportField } from "../../types";

/** チャンクと一緒に送る項目の情報 = domain.json の項目(DomainField)の name と fieldType */
export type ImportFieldTypeInfo = Pick<DomainField, "name"> & { fieldType: DomainField["fieldType"] | undefined };

/**
 * 型変換に使うフィールド情報を作る。
 * 集まりの項目（mediaCollection など）は CSV/ZIP に入らず、申告するとサーバーが 400 で拒否するので送らない
 */
export function buildImportFieldTypeInfo(fields: readonly ExportField[]): ImportFieldTypeInfo[] {
  return fields
    .filter((field) => !isCollectionFieldType(field.fieldType))
    .map((field) => ({ name: field.name, fieldType: field.fieldType }));
}
