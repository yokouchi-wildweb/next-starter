// src/lib/dataMigration/components/ExportSettingsModal.tsx

"use client";

import { useState, useCallback } from "react";
import Modal from "@/components/Overlays/Modal";
import { Button } from "@/components/Form/Button/Button";
import { Checkbox } from "@/components/_shadcn/checkbox";
import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";

export type ExportField = {
  name: string;
  label: string;
};

export type ExportSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: ExportField[];
  domainLabel: string;
  onExport?: (selectedFields: string[], includeImages: boolean) => void;
};

export function ExportSettingsModal({
  open,
  onOpenChange,
  fields,
  domainLabel,
  onExport,
}: ExportSettingsModalProps) {
  // システムフィールド
  const systemFields: ExportField[] = [
    { name: "id", label: "ID" },
    { name: "createdAt", label: "作成日時" },
    { name: "updatedAt", label: "更新日時" },
    { name: "deletedAt", label: "削除日時" },
  ];

  const allFields = [...systemFields.slice(0, 1), ...fields, ...systemFields.slice(1)];
  const allFieldNames = allFields.map((f) => f.name);

  const [selectedFields, setSelectedFields] = useState<string[]>(allFieldNames);
  const [includeImages, setIncludeImages] = useState(true);

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

  const handleExport = useCallback(() => {
    if (onExport) {
      onExport(selectedFields, includeImages);
    } else {
      // ダミー実装
      console.log("Export settings:", {
        selectedFields,
        includeImages,
      });
    }
    onOpenChange(false);
  }, [selectedFields, includeImages, onExport, onOpenChange]);

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
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={includeImages}
              onCheckedChange={(checked) => setIncludeImages(checked === true)}
            />
            <span className="text-sm">画像を含める（ZIP形式でダウンロード）</span>
          </label>
        </Block>

        {/* カラム選択 */}
        <Block className="mb-4">
          <Flex justify="between" align="center" className="mb-3">
            <span className="text-sm font-medium">エクスポートするカラム</span>
            <Flex gap="sm">
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

          <Block className="space-y-2 max-h-64 overflow-y-auto">
            {allFields.map((field) => (
              <label
                key={field.name}
                className="flex items-center gap-2 cursor-pointer py-1"
              >
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

        {/* フッター */}
        <Flex justify="end" gap="sm" className="pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleExport} disabled={isNoneSelected}>
            エクスポート
          </Button>
        </Flex>
      </Block>
    </Modal>
  );
}

export default ExportSettingsModal;
