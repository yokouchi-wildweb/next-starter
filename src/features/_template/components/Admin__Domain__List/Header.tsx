// src/features/__domain__/components/Admin__Domain__List/Header.tsx

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "../../../../components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { Button } from "@/components/Form/Button/Button";
import { DataMigrationModal, type ExportField } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/__domain__/domain.json";

export type Admin__Domain__ListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

// domain.json からフィールド情報を抽出（画像フィールドかどうかも判定、fieldType も含める）
const exportFields: ExportField[] = config.fields.map((field) => ({
  name: field.name,
  label: field.label,
  isImageField: field.formInput === "mediaUploader",
  fieldType: field.fieldType,
}));

// リレーションが存在するかどうか
const hasRelations = Array.isArray(config.relations) && config.relations.length > 0;

// hasMany リレーションを抽出（子データの選択用）
const hasManyDomains = (config.relations || [])
  .filter((r: any) => r.relationType === "hasMany")
  .map((r: any) => ({ domain: r.domain.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, ""), label: r.label }));

export default function Admin__Domain__ListHeader({ page, perPage, total }: Admin__Domain__ListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();
  const router = useRouter();
  const [isDataMigrationModalOpen, setIsDataMigrationModalOpen] = useState(false);

  const handleImportSuccess = useCallback(() => {
    // インポート成功時に一覧を再取得
    router.refresh();
  }, [router]);

  return (
    <>
      <ListTop title="登録済み__DomainLabel__の一覧" newHref="/admin/__domainsSlug__/new">
        {hasSearch && <SearchBox makeHref={(p) => `/admin/__domainsSlug__?${p.toString()}`} />}
        {config.useImportExport && (
          <Button variant="outline" onClick={() => setIsDataMigrationModalOpen(true)}>
            ファイル入出力
          </Button>
        )}
        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          makeHref={(p) => {
            const search = new URLSearchParams(params.toString());
            search.set("page", String(p));
            return `/admin/__domainsSlug__?${search.toString()}`;
          }}
        />
      </ListTop>

      {config.useImportExport && (
        <DataMigrationModal
          open={isDataMigrationModalOpen}
          onOpenChange={setIsDataMigrationModalOpen}
          domain={config.singular}
          fields={exportFields}
          domainLabel={config.label}
          searchParams={params.toString()}
          onImportSuccess={handleImportSuccess}
          hasRelations={hasRelations}
          hasManyDomains={hasManyDomains}
        />
      )}
    </>
  );
}
