// src/lib/dataMigration/components/DataMigrationButton.tsx
// データ入出力ボタン（モーダル含む）

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Form/Button/Button";
import { getDomainConfig } from "@/lib/domain";
import { DataMigrationModal } from "./DataMigrationModal";
import { useDataMigrationConfig } from "../hooks/useDataMigrationConfig";

export type DataMigrationButtonProps = {
  /** ドメイン名（singular, camelCase） */
  domain: string;
  /** 検索パラメータ（URL クエリ文字列形式、エクスポート時のフィルタ用） */
  searchParams?: string;
  /** ボタンのラベル（デフォルト: "ファイル入出力"） */
  label?: string;
};

/**
 * データ入出力ボタン
 * ボタンクリックでモーダルを開き、エクスポート/インポート機能を提供
 *
 * @example
 * <DataMigrationButton domain="sample" searchParams={params.toString()} />
 */
export function DataMigrationButton({
  domain,
  searchParams,
  label = "ファイル入出力",
}: DataMigrationButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // ドメイン設定を取得
  const config = getDomainConfig(domain);
  const { exportFields, hasRelations, hasManyDomains } = useDataMigrationConfig(config);

  const handleImportSuccess = useCallback(() => {
    // インポート成功時に一覧を再取得
    router.refresh();
  }, [router]);

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        {label}
      </Button>

      <DataMigrationModal
        open={isOpen}
        onOpenChange={setIsOpen}
        domain={domain}
        fields={exportFields}
        domainLabel={config.label}
        searchParams={searchParams}
        onImportSuccess={handleImportSuccess}
        hasRelations={hasRelations}
        hasManyDomains={hasManyDomains}
      />
    </>
  );
}
