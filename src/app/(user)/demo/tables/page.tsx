"use client";

import { useMemo, useState, useTransition } from "react";

import type { DataTableColumn } from "@/lib/tableSuite/DataTable";
import EditableGridTable, {
  type EditableGridCellChangeEvent,
  type EditableGridColumn,
} from "@/lib/tableSuite/EditableGridTable";
import RecordSelectionTable, {
  type RecordSelectionTableProps,
} from "@/lib/tableSuite/RecordSelectionTable";
import { Button } from "@/components/Form/Button/Button";
import { RadioGroupInput } from "@/components/Form/Manual/RadioGroupInput";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Main, PageTitle, Para, SecTitle, Span } from "@/components/TextBlocks";
import { cn } from "@/lib/cn";
import type { Sample } from "@/features/sample/entities";
import { useSampleList } from "@/features/sample/hooks/useSampleList";
import { sampleClient } from "@/features/sample/services/client/sampleClient";
import { resolveErrorMessage } from "@/lib/errors";

type SelectionBehavior = NonNullable<RecordSelectionTableProps<Sample>["selectionBehavior"]>;

const selectionBehaviorOptions: Array<{
  value: SelectionBehavior;
  label: string;
  description: string;
}> = [
  {
    value: "row",
    label: "行をクリックして選択",
    description: "レコード全体をクリックして切り替える操作感",
  },
  {
    value: "checkbox",
    label: "チェックボックスで選択",
    description: "チェックボックスのみで選択する安全な操作",
  },
];

const SAMPLE_SELECT_OPTIONS = [
  { value: "apple", label: "りんご" },
  { value: "orange", label: "オレンジ" },
  { value: "berry", label: "いちご" },
];

const formatDisplayValue = (value: unknown) => {
  if (value instanceof Date) {
    return value.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (value === null || value === undefined || value === "") {
    return "未設定";
  }

  return String(value);
};

export default function TablesDemoPage() {
  const [selectionBehavior, setSelectionBehavior] = useState<SelectionBehavior>("row");
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<Sample[]>([]);
  const [editableOverrides, setEditableOverrides] = useState<Record<string, Partial<Sample>>>({});
  const [lastEditSummary, setLastEditSummary] = useState("サンプルを編集するとログが更新されます");
  const [isPending, startTransition] = useTransition();
  const { data: sampleList = [], isLoading: isSampleLoading } = useSampleList();

  const normalizedSampleList = useMemo(
    () =>
      sampleList.map((row) => ({
        ...row,
        createdAt: row.createdAt ? new Date(row.createdAt) : null,
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      })),
    [sampleList],
  );

  const editableRows = useMemo(
    () =>
      normalizedSampleList.map((row) => ({
        ...row,
        ...(editableOverrides[row.id] ?? {}),
      })),
    [editableOverrides, normalizedSampleList],
  );

  const columns: DataTableColumn<Sample>[] = useMemo(
    () => [
      {
        header: "サンプル名 / 説明",
        render: (record) => (
          <Block className="space-y-1">
            <Span weight="medium" className="text-foreground">
              {record.name}
            </Span>
            <Para size="sm" tone="muted" className="leading-snug">
              {record.description ?? "説明が未登録です"}
            </Para>
          </Block>
        ),
      },
      {
        header: "カテゴリ",
        render: (record) => {
          const appearance = SAMPLE_SELECT_OPTIONS.find((option) => option.value === record.select);
          return (
            <Span
              size="sm"
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                appearance ? "border-primary/50 text-primary" : "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {appearance?.label ?? "未分類"}
            </Span>
          );
        },
      },
      {
        header: "更新日時 / 数量",
        render: (record) => (
          <Block className="space-y-1">
            <Para size="sm" tone="default" className="font-medium">
              最終更新: {record.updatedAt ? formatDisplayValue(new Date(record.updatedAt)) : "未設定"}
            </Para>
            <Para size="xs" tone="muted">
              数量: {record.number ?? "-"} / リッチナンバー: {record.rich_number ?? "-"}
            </Para>
          </Block>
        ),
      },
    ],
    [],
  );

  const editableColumns = useMemo<EditableGridColumn<Sample>[]>(
    () => [
      {
        field: "name",
        header: "名前",
        editorType: "text",
        placeholder: "例: 新商品 A",
        validator: (value) => {
          if (!value || String(value).trim().length === 0) {
            return "名前は必須です";
          }
          if (String(value).length > 40) {
            return "40文字以内で入力してください";
          }
          return null;
        },
      },
      {
        field: "number",
        header: "数量",
        editorType: "number",
        placeholder: "0 以上の整数",
        validator: (value) => {
          if (value == null || value === "") {
            return null;
          }
          if (typeof value === "number" && value < 0) {
            return "0以上の値を入力してください";
          }
          return null;
        },
      },
      {
        field: "select",
        header: "カテゴリ",
        editorType: "select",
        placeholder: "カテゴリを選択",
        options: SAMPLE_SELECT_OPTIONS,
      },
      {
        field: "description",
        header: "説明文",
        editorType: "text",
        placeholder: "任意で概要を入力",
        validator: (value) => {
          if (typeof value === "string" && value.length > 120) {
            return "120文字以内で入力してください";
          }
          return null;
        },
      },
      {
        field: "updatedAt",
        header: "最終更新日時",
        editorType: "datetime",
        placeholder: "日時を選択",
        parseValue: (value) => (value ? new Date(value) : null),
      },
    ],
    [],
  );

  const editableColumnHeaderMap = useMemo(
    () =>
      editableColumns.reduce<Record<string, string>>((acc, column) => {
        acc[column.field] = column.header;
        return acc;
      }, {}),
    [editableColumns],
  );

  const handleSelectionChange = (keys: React.Key[], rows: Sample[]) => {
    setSelectedKeys(keys);
    setSelectedRows(rows);
  };

  const handleEditableCellChange = (event: EditableGridCellChangeEvent<Sample>) => {
    setEditableOverrides((prev) => {
      const rowKey = String(event.rowKey);
      const nextOverrides = { ...(prev[rowKey] ?? {}), [event.field]: event.value };
      return { ...prev, [rowKey]: nextOverrides };
    });

    const columnLabel = editableColumnHeaderMap[event.field] ?? event.field;
    setLastEditSummary(
      `${String(event.rowKey)} の ${columnLabel} を ${formatDisplayValue(event.value)} に更新しました`,
    );

    startTransition(async () => {
      try {
        await sampleClient.update(String(event.rowKey), { [event.field]: event.value });
      } catch (error) {
        setLastEditSummary(resolveErrorMessage(error, "更新に失敗しました"));
      }
    });
  };

  const handleResetEditableRows = () => {
    setEditableOverrides({});
    setLastEditSummary("編集内容を初期化しました");
  };

  const selectedSummary =
    selectedRows.length === 0
      ? "まだレコードが選択されていません"
      : `${selectedRows.length} 件を選択中 (${selectedRows.map((row) => row.name).join(" / ")})`;
  const selectionBehaviorField = {
    value: selectionBehavior,
    onChange: (value: string) => setSelectionBehavior(value as SelectionBehavior),
  };
  const selectionBehaviorRadioOptions = selectionBehaviorOptions.map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const selectedBehaviorDescription =
    selectionBehaviorOptions.find((option) => option.value === selectionBehavior)?.description ?? "";

  return (
    <Main containerType="wideShowcase" className="space-y-10 py-12">
      <Section space="lg">
        <PageTitle size="xxl" className="font-semibold">
          RecordSelectionTable デモ
        </PageTitle>
        <Para tone="muted" size="sm">
          実データベース上の「サンプル」レコードを読み込み、行クリック / チェックボックスによる複数選択を切り替えられるサンプルです。
        </Para>
      </Section>

      <Section space="lg">
        <Flex direction="columnToRowSm" gap="xl" align="start">
          <Block className="w-full flex-1 space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
            <Block className="space-y-2">
              <SecTitle size="lg" className="font-semibold">
                インタラクティブな選択テーブル
              </SecTitle>
              <Para tone="muted" size="sm">
                操作方法を切り替えて、RecordSelectionTable の挙動を確認できます。全選択や部分選択の状態はヘッダのチェックボックスで判別できます。
              </Para>
            </Block>

            <Block className="space-y-3 rounded-xl border bg-background/70 p-4">
              <Span size="sm" tone="muted" className="font-semibold">
                選択方法
              </Span>
              <Flex direction="column" gap="sm">
                <Flex gap="sm" wrap="wrap">
                  <RadioGroupInput
                    className="flex-1 gap-3 [&>button]:flex-1 [&>button]:justify-center [&>button]:text-center [&>button]:font-medium [&>button]:py-3"
                    field={selectionBehaviorField}
                    options={selectionBehaviorRadioOptions}
                    displayType="standard"
                    buttonSize="md"
                  />
                  <Button
                    type="button"
                    size="md"
                    variant="outline"
                    className="flex-1 min-w-[180px] justify-center text-center font-medium py-3"
                    onClick={() => setSelectedKeys([])}
                  >
                    選択をクリア
                  </Button>
                </Flex>
                <Para size="xs" tone="muted" className="text-center">
                  {selectedBehaviorDescription}
                </Para>
              </Flex>
            </Block>

            <RecordSelectionTable
              items={sampleList}
              columns={columns}
              getKey={(record) => record.id}
              selectedKeys={selectedKeys}
              onSelectionChange={handleSelectionChange}
              selectionBehavior={selectionBehavior}
              emptyValueFallback="-"
              rowClassName={(record, { selected }) => {
                if (selected) {
                  return "bg-primary/5";
                }
                if (record.select === "apple") {
                  return "bg-emerald-50/60";
                }
                if (record.select === "orange") {
                  return "bg-amber-50/60";
                }
                if (record.select === "berry") {
                  return "bg-rose-50/60";
                }
                return "";
              }}
            />
            {isSampleLoading && (
              <Para size="xs" tone="muted">
                サンプルデータを読み込み中です…
              </Para>
            )}
          </Block>

          <Block className="w-full max-w-md space-y-4 rounded-2xl border bg-muted/20 p-6">
            <SecTitle size="md" className="font-semibold">
              選択状態プレビュー
            </SecTitle>
            <Para tone="muted" size="sm">
              {selectedSummary}
            </Para>
            {selectedRows.length > 0 && (
              <ul className="space-y-3">
                {selectedRows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-dashed bg-background/70 p-3"
                  >
                    <Span weight="medium" className="text-foreground">
                      {row.name}
                    </Span>
                    <Para size="xs" tone="muted" className="mt-1">
                      カテゴリ: {row.select ?? "未分類"} / 数量: {row.number ?? "-"}
                    </Para>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </Flex>
      </Section>

      <Section space="lg">
        <Flex direction="columnToRowSm" gap="xl" align="start">
          <Block className="w-full flex-1 space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
            <Block className="space-y-2">
              <SecTitle size="lg" className="font-semibold">
                EditableGridTable デモ
              </SecTitle>
              <Para tone="muted" size="sm">
                サンプルドメインのレコードを使ったインライン編集のサンプルです。セルの入力がバリデーションに通ると、その場で行データが更新されます。
              </Para>
            </Block>

            <EditableGridTable
              rows={editableRows}
              columns={editableColumns}
              getKey={(row) => row.id}
              onCellChange={handleEditableCellChange}
              emptyValueFallback="-"
              tableLayout="fixed"
            />
            {(isSampleLoading || isPending) && (
              <Para size="xs" tone="muted">
                データベースと同期中です…
              </Para>
            )}
          </Block>

          <Block className="w-full max-w-md space-y-4 rounded-2xl border bg-muted/20 p-6">
            <SecTitle size="md" className="font-semibold">
              更新ログ
            </SecTitle>
            <Para tone="muted" size="sm">
              {lastEditSummary}
            </Para>
            <Button type="button" variant="outline" size="sm" onClick={handleResetEditableRows}>
              編集内容をリセット
            </Button>
            <Block className="space-y-2">
              <Span size="sm" weight="medium">
                現在のデータ
              </Span>
              <ul className="max-h-64 space-y-2 overflow-auto">
                {editableRows.map((row) => (
                  <li key={row.id} className="rounded-lg border border-dashed bg-background/70 p-3">
                    <Span weight="medium" className="text-foreground">
                      {row.name}
                    </Span>
                    <Para size="xs" tone="muted" className="mt-1 leading-relaxed">
                      数量: {row.number ?? "-"} / カテゴリ: {row.select ?? "-"}
                      <br />
                      最終更新: {formatDisplayValue(row.updatedAt)}
                    </Para>
                  </li>
                ))}
              </ul>
            </Block>
          </Block>
        </Flex>
      </Section>
    </Main>
  );
}
