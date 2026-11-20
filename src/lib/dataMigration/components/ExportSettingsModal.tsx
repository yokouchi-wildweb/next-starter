// src/lib/dataMigration/components/ExportSettingsModal.tsx

"use client";

import { useCallback, useId, useMemo, useState } from "react";
import axios from "axios";
import Modal from "@/components/Overlays/Modal";
import { Button } from "@/components/Button/Button";
import { BooleanCheckboxInput } from "@/components/Input/BooleanCheckboxInput";
import { Label } from "@/components/Input/Label";
import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import { Span } from "@/components/TextBlocks/Span";
import type { DomainDisplayField } from "@/lib/domain";

/** 書き出す項目 = 写しの項目(DomainDisplayField)の name・label・fieldType(型変換用) + 画像の印 */
export type ExportField = Pick<DomainDisplayField, "name" | "label" | "fieldType"> & {
  /** 画像フィールドかどうか（formInput: "mediaUploader"） */
  isImageField?: boolean;
};

export type ExportSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ドメイン名（API 呼び出し用） */
  domain: string;
  /** フィールド情報 */
  fields: ExportField[];
  /** ドメインの表示名 */
  domainLabel: string;
  /** 検索パラメータ（URL クエリ文字列形式） */
  searchParams?: string;
};

/** システムフィールド */
const SYSTEM_FIELDS: ExportField[] = [
  { name: "id", label: "ID" },
  { name: "createdAt", label: "作成日時" },
  { name: "updatedAt", label: "更新日時" },
  { name: "deletedAt", label: "削除日時" },
];

export function ExportSettingsModal({
  open,
  onOpenChange,
  domain,
  fields,
  domainLabel,
  searchParams,
}: ExportSettingsModalProps) {
  // 出力できる欄(id → 項目 → 日時の順)。fields が変わったときだけ作り直す(全選択の callback の依存になる)
  const allFields = useMemo(() => [...SYSTEM_FIELDS.slice(0, 1), ...fields, ...SYSTEM_FIELDS.slice(1)], [fields]);
  const allFieldNames = useMemo(() => allFields.map((f) => f.name), [allFields]);

  // 画像フィールドを抽出
  const imageFieldNames = fields.filter((f) => f.isImageField).map((f) => f.name);

  const [selectedFields, setSelectedFields] = useState<string[]>(allFieldNames);
  const [includeImages, setIncludeImages] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // チェックボックスと文言を htmlFor / id で結ぶ(一覧の行は key を足した id)
  const checkboxIdBase = useId();

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
      prev.includes(fieldName)
        ? prev.filter((f) => f !== fieldName)
        : [...prev, fieldName]
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
  }, [domain, selectedFields, includeImages, searchParams, imageFieldNames, onOpenChange]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`${domainLabel}のエクスポート設定`}
      maxWidth={480}
      maxHeight="80vh"
    >
      <Block className="p-4">
        {/* 画像オプション */}
        <Block className="mb-4 pb-4 border-b border-border">
          <Label htmlFor={`${checkboxIdBase}-images`} className="cursor-pointer font-normal leading-normal">
            <BooleanCheckboxInput
              id={`${checkboxIdBase}-images`}
              value={includeImages}
              onChange={(checked) => setIncludeImages(checked === true)}
            />
            <Span size="sm" weight="inherit">画像を含める（ZIP形式でダウンロード）</Span>
          </Label>
        </Block>

        {/* カラム選択 */}
        <Block className="mb-4">
          <Flex justify="between" align="center" className="mb-3">
            <Span size="sm" weight="medium">エクスポートするカラム</Span>
            <Flex gap="md">
              <Button
                size="xs"
                variant="outline"
                onClick={handleSelectAll}
                disabled={isAllSelected}
              >
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
              <Label
                key={field.name}
                htmlFor={`${checkboxIdBase}-field-${field.name}`}
                className="cursor-pointer py-1 font-normal leading-normal"
              >
                <BooleanCheckboxInput
                  id={`${checkboxIdBase}-field-${field.name}`}
                  value={selectedFields.includes(field.name)}
                  onChange={() => handleToggleField(field.name)}
                />
                <Span size="sm" weight="inherit">
                  {field.label}
                  <Span inline tone="muted" className="ml-1">({field.name})</Span>
                </Span>
              </Label>
            ))}
          </Block>
        </Block>

        {/* エラー表示 */}
        {error && (
          <Block className="mb-4 p-3 bg-destructive/10 text-destructive-text text-sm rounded">
            {error}
          </Block>
        )}

        {/* フッター */}
        <Flex justify="end" gap="md" className="pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            キャンセル
          </Button>
          <Button onClick={handleExport} disabled={isNoneSelected || isExporting}>
            {isExporting ? "エクスポート中..." : "エクスポート"}
          </Button>
        </Flex>
      </Block>
    </Modal>
  );
}

export default ExportSettingsModal;
