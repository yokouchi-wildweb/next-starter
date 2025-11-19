"use client";

import { useMemo, useState } from "react";

import { RecordSelectionTable, type DataTableColumn, type RecordSelectionTableProps } from "@/components/DataTable";
import { Button } from "@/components/Form/Button/Button";
import { RadioGroupInput } from "@/components/Form/Manual/RadioGroupInput";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Main, PageTitle, Para, SecTitle, Span } from "@/components/TextBlocks";
import { cn } from "@/lib/cn";

type DemoRecord = {
  id: string;
  company: string;
  contactName: string;
  email: string;
  status: "active" | "attention" | "inactive";
  lastActivity: string;
};

const demoRecords: DemoRecord[] = [
  {
    id: "cust-001",
    company: "Acme Foods",
    contactName: "山田 太郎",
    email: "taro.yamada@example.com",
    status: "active",
    lastActivity: "2024/06/24 見積送付",
  },
  {
    id: "cust-002",
    company: "Future Logistics",
    contactName: "斎藤 由美",
    email: "yumi.saito@example.com",
    status: "attention",
    lastActivity: "2024/06/19 契約更新依頼",
  },
  {
    id: "cust-003",
    company: "北斗印刷",
    contactName: "田中 信吾",
    email: "shingo.tanaka@example.com",
    status: "active",
    lastActivity: "2024/06/10 製品紹介",
  },
  {
    id: "cust-004",
    company: "Cyan Security",
    contactName: "加藤 充",
    email: "mitsuru.kato@example.com",
    status: "inactive",
    lastActivity: "2024/05/28 解約完了",
  },
  {
    id: "cust-005",
    company: "Leaf Works",
    contactName: "杉本 可奈",
    email: "kana.sugimoto@example.com",
    status: "attention",
    lastActivity: "2024/06/05 請求書送付",
  },
  {
    id: "cust-006",
    company: "Bright Insights",
    contactName: "三浦 裕",
    email: "yu.miura@example.com",
    status: "active",
    lastActivity: "2024/06/21 PoC 実施中",
  },
];

const statusAppearance: Record<DemoRecord["status"], { label: string; className: string }> = {
  active: {
    label: "稼働中",
    className: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  attention: {
    label: "要フォロー",
    className: "text-amber-600 bg-amber-50 border-amber-200",
  },
  inactive: {
    label: "停止中",
    className: "text-slate-500 bg-slate-50 border-slate-200",
  },
};

type SelectionBehavior = NonNullable<RecordSelectionTableProps<DemoRecord>["selectionBehavior"]>;

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

export default function TablesDemoPage() {
  const [selectionBehavior, setSelectionBehavior] = useState<SelectionBehavior>("row");
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<DemoRecord[]>([]);

  const columns: DataTableColumn<DemoRecord>[] = useMemo(
    () => [
      {
        header: "取引先 / 担当者",
        render: (record) => (
          <Block className="space-y-1">
            <Span weight="medium" className="text-foreground">
              {record.company}
            </Span>
            <Para size="sm" tone="muted" className="leading-snug">
              {record.contactName}
            </Para>
          </Block>
        ),
      },
      {
        header: "ステータス",
        render: (record) => {
          const appearance = statusAppearance[record.status];
          return (
            <Span
              size="sm"
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                appearance.className,
              )}
            >
              {appearance.label}
            </Span>
          );
        },
      },
      {
        header: "連絡先 / 最終アクション",
        render: (record) => (
          <Block className="space-y-1">
            <Para size="sm" tone="default" className="font-medium">
              {record.email}
            </Para>
            <Para size="xs" tone="muted">
              {record.lastActivity}
            </Para>
          </Block>
        ),
      },
    ],
    [],
  );

  const handleSelectionChange = (keys: React.Key[], rows: DemoRecord[]) => {
    setSelectedKeys(keys);
    setSelectedRows(rows);
  };

  const selectedSummary =
    selectedRows.length === 0
      ? "まだレコードが選択されていません"
      : `${selectedRows.length} 件を選択中`;
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
          チェックボックス付きのリストを用意し、行クリック / チェックボックスによる複数選択を切り替えられるサンプルです。
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
              items={demoRecords}
              columns={columns}
              getKey={(record) => record.id}
              selectedKeys={selectedKeys}
              onSelectionChange={handleSelectionChange}
              selectionBehavior={selectionBehavior}
              rowClassName={(record, { selected }) => {
                if (selected) {
                  return "bg-primary/5";
                }
                if (record.status === "attention") {
                  return "bg-amber-50/40";
                }
                return "";
              }}
            />
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
                      {row.company}
                    </Span>
                    <Para size="xs" tone="muted" className="mt-1">
                      担当: {row.contactName} / {row.email}
                    </Para>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </Flex>
      </Section>
    </Main>
  );
}
