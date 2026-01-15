// src/features/sampleTag/components/AdminSampleTagList/Header.tsx

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "../../../../components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { Button } from "@/components/Form/Button/Button";
import { DataMigrationModal, type ExportField } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/sampleTag/domain.json";

export type AdminSampleTagListHeaderProps = {
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

export default function AdminSampleTagListHeader({ page, perPage, total }: AdminSampleTagListHeaderProps) {
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
      <ListTop title="登録済みサンプルタグの一覧" newHref="/admin/sample-tags/new">
        {hasSearch && <SearchBox makeHref={(p) => `/admin/sample-tags?${p.toString()}`} />}
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
            return `/admin/sample-tags?${search.toString()}`;
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
        />
      )}
    </>
  );
}
