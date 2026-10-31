// src/lib/dataMigration/configUtils.ts
// 写し(entities/display.ts)から DataMigration 用の設定を生成するユーティリティ

import type { DomainDisplay } from "@/lib/domain/types/display";
import type { ExportField } from "./components/ExportSettingsModal";

/**
 * 写しの fields から ExportField[] を生成
 *
 * @example
 * import { domainDisplay } from "@/features/sample/entities/display";
 * const exportFields = buildExportFields(domainDisplay);
 */
export function buildExportFields(config: Pick<DomainDisplay, "fields">): ExportField[] {
  return config.fields.map((field) => ({
    name: field.name,
    label: field.label,
    isImageField: field.formInput === "mediaUploader",
    fieldType: field.fieldType,
  }));
}
