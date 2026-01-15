// src/features/sample/components/AdminSampleList/Header.tsx

"use client";

import { useState } from "react";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "../../../../components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { Button } from "@/components/Form/Button/Button";
import { ExportSettingsModal, type ExportField } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/sample/domain.json";

export type AdminSampleListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

// domain.json からフィールド情報を抽出（画像フィールドかどうかも判定）
const exportFields: ExportField[] = config.fields.map((field) => ({
  name: field.name,
  label: field.label,
  isImageField: field.formInput === "mediaUploader",
}));

export default function AdminSampleListHeader({ page, perPage, total }: AdminSampleListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  return (
    <>
      <ListTop title="登録済みサンプルの一覧" newHref="/admin/samples/new">
        {hasSearch && <SearchBox makeHref={(p) => `/admin/samples?${p.toString()}`} />}
        <Button variant="outline" onClick={() => setIsExportModalOpen(true)}>
          エクスポート
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

      <ExportSettingsModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        domain={config.singular}
        fields={exportFields}
        domainLabel={config.label}
        searchParams={params.toString()}
      />
    </>
  );
}
