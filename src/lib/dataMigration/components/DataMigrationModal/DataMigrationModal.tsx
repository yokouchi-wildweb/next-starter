// src/lib/dataMigration/components/DataMigrationModal/DataMigrationModal.tsx

"use client";

import TabbedModal from "@/components/Overlays/TabbedModal";
import { ExportTab } from "./ExportTab";
import { ImportTab } from "./ImportTab";
import type { DataMigrationModalProps } from "./types";

/**
 * データ移行（エクスポート/インポート）モーダル
 */
export function DataMigrationModal({
  open,
  onOpenChange,
  domain,
  fields,
  domainLabel,
  searchParams,
  onImportSuccess,
  hasRelations = false,
  hasManyDomains = [],
}: DataMigrationModalProps) {
  // 画像フィールドを抽出
  const imageFieldNames = fields.filter((f) => f.isImageField).map((f) => f.name);

  const tabs = [
    {
      value: "export",
      label: "エクスポート",
      content: (
        <ExportTab
          domain={domain}
          fields={fields}
          searchParams={searchParams}
          onOpenChange={onOpenChange}
          hasRelations={hasRelations}
          hasManyDomains={hasManyDomains}
        />
      ),
    },
    {
      value: "import",
      label: "インポート",
      content: (
        <ImportTab
          domain={domain}
          imageFields={imageFieldNames}
          fields={fields}
          onOpenChange={onOpenChange}
          onImportSuccess={onImportSuccess}
        />
      ),
    },
  ];

  return (
    <TabbedModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${domainLabel}のファイル入出力`}
      maxWidth={480}
      maxHeight="80vh"
      tabs={tabs}
      ariaLabel="エクスポート・インポートの切り替え"
    />
  );
}

export default DataMigrationModal;
