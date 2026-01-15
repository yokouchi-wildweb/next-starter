// src/features/sample/components/AdminSampleList/Header.tsx

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "../../../../components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { Button } from "@/components/Form/Button/Button";
import { DataMigrationModal, type ExportField } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/sample/domain.json";

export type AdminSampleListHeaderProps = {
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

export default function AdminSampleListHeader({ page, perPage, total }: AdminSampleListHeaderProps) {
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
      <ListTop title="登録済みサンプルの一覧" newHref="/admin/samples/new">
        {hasSearch && <SearchBox makeHref={(p) => `/admin/samples?${p.toString()}`} />}
        <Button variant="outline" onClick={() => setIsDataMigrationModalOpen(true)}>
          ファイル入出力
        </Button>
        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          makeHref={(p) => {
            const search = new URLSearchParams(params.toString());
            search.set("page", String(p));
            return `/admin/samples?${search.toString()}`;
          }}
        />
      </ListTop>

      <DataMigrationModal
        open={isDataMigrationModalOpen}
        onOpenChange={setIsDataMigrationModalOpen}
        domain={config.singular}
        fields={exportFields}
        domainLabel={config.label}
        searchParams={params.toString()}
        onImportSuccess={handleImportSuccess}
      />
    </>
  );
}
