// src/lib/dataMigration/components/DataMigrationModal/ExportTab.tsx
// エクスポートタブのコンテンツ

"use client";

import { useState, useCallback } from "react";
import axios from "axios";
import { Button } from "@/components/Form/Button/Button";
import { Checkbox } from "@/components/_shadcn/checkbox";
import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import type { ExportTabContentProps, ExportField } from "./types";

/**
 * エクスポートタブのコンテンツ
 */
export function ExportTab({
  domain,
  fields,
  searchParams,
  onOpenChange,
  hasRelations = false,
  hasManyDomains = [],
}: ExportTabContentProps) {
  // システムフィールド
  const systemFields: ExportField[] = [
    { name: "id", label: "ID" },
    { name: "createdAt", label: "作成日時" },
    { name: "updatedAt", label: "更新日時" },
    { name: "deletedAt", label: "削除日時" },
  ];

  const allFields = [...systemFields.slice(0, 1), ...fields, ...systemFields.slice(1)];
  const allFieldNames = allFields.map((f) => f.name);

  // 画像フィールドを抽出
  const imageFieldNames = fields.filter((f) => f.isImageField).map((f) => f.name);

  const [selectedFields, setSelectedFields] = useState<string[]>(allFieldNames);
  const [includeImages, setIncludeImages] = useState(true);
  const [includeRelations, setIncludeRelations] = useState(false);
  const [selectedHasManyDomains, setSelectedHasManyDomains] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAllSelected = selectedFields.length === allFieldNames.length;
  const isNoneSelected = selectedFields.length === 0;

  const handleSelectAll = useCallback(() => {
    setSelectedFields(allFieldNames);
  }, [allFieldNames]);

  const handleDeselectAll = useCallback(() => {
    setSelectedFields([]);
  }, []);

  const handleToggleField = useCallback((fieldName: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldName) ? prev.filter((f) => f !== fieldName) : [...prev, fieldName]
    );
  }, []);

  const handleToggleHasManyDomain = useCallback((domainName: string) => {
    setSelectedHasManyDomains((prev) =>
      prev.includes(domainName) ? prev.filter((d) => d !== domainName) : [...prev, domainName]
    );
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await axios.post(
        "/api/data-migration/export",
        {
          domain,
          selectedFields,
          includeImages,
          searchParams,
          imageFields: includeImages ? imageFieldNames : [],
          includeRelations,
          selectedHasManyDomains: includeRelations ? selectedHasManyDomains : [],
        },
        {
          responseType: "blob",
        }
      );

      // ファイル名をヘッダーから取得
      const contentDisposition = response.headers["content-disposition"];
      let filename = `${domain}_export.zip`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Blob をダウンロード
      const blob = new Blob([response.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (err) {
      console.error("Export failed:", err);
      if (axios.isAxiosError(err) && err.response?.data) {
        // Blob を JSON に変換してエラーメッセージを取得
        const blob = err.response.data as Blob;
        try {
          const text = await blob.text();
          const json = JSON.parse(text);
          setError(json.error || "エクスポートに失敗しました");
        } catch {
          setError("エクスポートに失敗しました");
        }
      } else {
        setError("エクスポートに失敗しました");
      }
    } finally {
      setIsExporting(false);
    }
  }, [domain, selectedFields, includeImages, searchParams, imageFieldNames, onOpenChange, includeRelations, selectedHasManyDomains]);

  return (
    <Block className="p-4">
      {/* エクスポートオプション */}
      <Block className="mb-4 pb-4 border-b border-border flex flex-col gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={includeImages}
            onCheckedChange={(checked) => setIncludeImages(checked === true)}
          />
          <span className="text-sm">画像を含める（ZIP形式でダウンロード）</span>
        </label>
        {hasRelations && (
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={includeRelations}
              onCheckedChange={(checked) => setIncludeRelations(checked === true)}
            />
            <span className="text-sm">リレーションを含める（関連データも一緒にエクスポート）</span>
          </label>
        )}
        {/* hasMany ドメイン選択（リレーションを含める場合のみ表示） */}
        {includeRelations && hasManyDomains.length > 0 && (
          <Block className="ml-6 mt-2 flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">子データの選択:</span>
            {hasManyDomains.map((hm) => (
              <label key={hm.domain} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedHasManyDomains.includes(hm.domain)}
                  onCheckedChange={() => handleToggleHasManyDomain(hm.domain)}
                />
                <span className="text-sm">{hm.label}</span>
              </label>
            ))}
          </Block>
        )}
      </Block>

      {/* カラム選択 */}
      <Block className="mb-4">
        <Flex justify="between" align="center" className="mb-3">
          <span className="text-sm font-medium">エクスポートするカラム</span>
          <Flex gap="sm">
            <Button size="xs" variant="outline" onClick={handleSelectAll} disabled={isAllSelected}>
              全選択
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={handleDeselectAll}
              disabled={isNoneSelected}
            >
              全解除
            </Button>
          </Flex>
        </Flex>

        <Block className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {allFields.map((field) => (
            <label key={field.name} className="flex items-center gap-2 cursor-pointer py-1">
              <Checkbox
                checked={selectedFields.includes(field.name)}
                onCheckedChange={() => handleToggleField(field.name)}
              />
              <span className="text-sm">
                {field.label}
                <span className="text-muted-foreground ml-1">({field.name})</span>
              </span>
            </label>
          ))}
        </Block>
      </Block>

      {/* エラー表示 */}
      {error && (
        <Block className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
          {error}
        </Block>
      )}

      {/* フッター */}
      <Flex justify="end" gap="sm" className="pt-4 border-t border-border">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
          キャンセル
        </Button>
        <Button onClick={handleExport} disabled={isNoneSelected || isExporting}>
          {isExporting ? "エクスポート中..." : "エクスポート"}
        </Button>
      </Flex>
    </Block>
  );
}
