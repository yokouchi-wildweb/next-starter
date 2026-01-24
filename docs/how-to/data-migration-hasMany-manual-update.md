# hasMany 対応：コンポーネント手動更新ガイド

`dc:generate` でコンポーネントを再生成できない場合の手動更新手順。

## 前提条件

- domain.json に `useImportExport: true` が設定されていること
- domain.json に hasMany リレーションが定義されていること

## 手順

### 1. domain.json の更新

```json
{
  "relations": [
    {
      "domain": "子ドメイン名",
      "label": "子ドメインラベル",
      "fieldName": "子ドメイン側の外部キー",
      "relationType": "hasMany"
    }
  ],
  "useImportExport": true
}
```

例（sampleCategory → sample）:
```json
{
  "relations": [
    {
      "domain": "sample",
      "label": "サンプル",
      "fieldName": "sample_category_id",
      "relationType": "hasMany"
    }
  ],
  "useImportExport": true
}
```

### 2. Header.tsx の更新

対象ファイル: `src/features/{domain}/components/Admin{Domain}List/Header.tsx`

#### 2-A. useImportExport が既に true だった場合

**Step 1: import に追加**

```diff
 import { DataMigrationModal, type ExportField } from "@/lib/dataMigration";
 import { useSearchParams } from "next/navigation";
+import { toSnakeCase } from "@/utils/stringCase.mjs";
 import config from "@/features/{domain}/domain.json";
```

**Step 2: hasManyDomains 定数を追加**

`hasRelations` の下に追加:

```diff
 // リレーションが存在するかどうか
 const hasRelations = Array.isArray(config.relations) && config.relations.length > 0;

+// hasMany リレーションを抽出（子データの選択用）
+const hasManyDomains = (config.relations || [])
+  .filter((r: any) => r.relationType === "hasMany")
+  .map((r: any) => ({ domain: toSnakeCase(r.domain), label: r.label }));
```

**Step 3: DataMigrationModal に props 追加**

```diff
 <DataMigrationModal
   open={isDataMigrationModalOpen}
   onOpenChange={setIsDataMigrationModalOpen}
   domain={config.singular}
   fields={exportFields}
   domainLabel={config.label}
   searchParams={params.toString()}
   onImportSuccess={handleImportSuccess}
   hasRelations={hasRelations}
+  hasManyDomains={hasManyDomains}
 />
```

#### 2-B. useImportExport が false だった場合（HeaderSimple.tsx → Header.tsx）

ファイル全体を以下のテンプレートで置き換え。`{domain}`, `{Domain}`, `{DomainLabel}`, `{domainsSlug}` を適宜置換:

```tsx
// src/features/{domain}/components/Admin{Domain}List/Header.tsx

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "../../../../components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { Button } from "@/components/Form/Button/Button";
import { DataMigrationModal, type ExportField } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import { toSnakeCase } from "@/utils/stringCase.mjs";
import config from "@/features/{domain}/domain.json";
import { CreateButton } from "@/lib/crud/components/Buttons";

export type Admin{Domain}ListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

// domain.json からフィールド情報を抽出
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
  .map((r: any) => ({ domain: toSnakeCase(r.domain), label: r.label }));

export default function Admin{Domain}ListHeader({ page, perPage, total }: Admin{Domain}ListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();
  const router = useRouter();
  const [isDataMigrationModalOpen, setIsDataMigrationModalOpen] = useState(false);

  const handleImportSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <>
      <ListTop title="登録済み{DomainLabel}の一覧">
        {hasSearch && <SearchBox makeHref={(p) => `/admin/{domainsSlug}?${p.toString()}`} />}
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
            return `/admin/{domainsSlug}?${search.toString()}`;
          }}
        />
        <CreateButton href="/admin/{domainsSlug}/new" />
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
```

**置換例（sampleCategory の場合）:**

| プレースホルダ | 値 |
|--------------|-----|
| `{domain}` | `sampleCategory` |
| `{Domain}` | `SampleCategory` |
| `{DomainLabel}` | `サンプルカテゴリ` |
| `{domainsSlug}` | `sample-categories` |

## 動作確認

1. 管理画面で「ファイル入出力」ボタンが表示される
2. 「リレーションを含める」チェック時に「子データの選択」が表示される
3. hasMany ドメインを選択してエクスポートできる
4. エクスポートした ZIP をインポートできる
