// src/lib/dataMigration/configUtils.ts
// domain.json から DataMigration 用の設定を生成するユーティリティ

import type { DomainConfig } from "@/lib/domain";
import type { ExportField } from "./components/ExportSettingsModal";

/**
 * domain.json の fields から ExportField[] を生成
 *
 * @example
 * import config from "@/features/sample/domain.json";
 * const exportFields = buildExportFields(config);
 */
export function buildExportFields(config: DomainConfig): ExportField[] {
  return config.fields.map((field) => ({
    name: field.name,
    label: field.label,
    isImageField: field.formInput === "mediaUploader",
    fieldType: field.fieldType,
  }));
}
