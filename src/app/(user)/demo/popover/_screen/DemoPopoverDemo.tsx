// src/app/(user)/demo/popover/_screen/DemoPopoverDemo.tsx
// /demo/popover のデモ本体(client)。Screen が描く。

"use client";

import { useState, useCallback } from "react";
import { Edit, Copy, Trash, MoreVertical, Settings, Send, Archive, Star } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Section } from "@/components/Layout/Section";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { PageTitle } from "@/components/TextBlocks/PageTitle";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import { useToast } from "@/lib/toast";

// Popover コンポーネント群
import {
  Popover,
  ConfirmPopover,
  PromptPopover,
  ActionPopover,
  InfoPopover,
  ChecklistPopover,
  SelectPopover,
} from "@/components/Overlays/Popover";
import { DataTable, RecordSelectionTable } from "@/lib/tableSuite";
import { EnumFieldButton, BelongsToFieldButton, BelongsToManyFieldButton, BulkDeleteButton, BulkEnumFieldButton, BulkBelongsToFieldButton, BulkBelongsToManyFieldButton } from "@/lib/crud/components/Buttons";
import useSWR from "swr";
import { sampleClient } from "@/features/sample/services/client/sampleClient";
import type { SampleWithRelations } from "@/features/sample/entities/model";
import { Flex } from "@/components/Layout/Flex";
import { InlineLoader } from "@/components/Overlays/Loading/InlineLoader";
import { Tooltip } from "@/components/Overlays/Tooltip";
import { HoverCard } from "@/components/Overlays/HoverCard";
import { domainDisplay as sampleDisplay } from "@/features/sample/entities/display";

// デモ用のダミーデータ
const DEMO_SHIPMENTS = [
  { id: 1, orderId: "ORD-001", status: "shipped", trackingNumber: "" },
  { id: 2, orderId: "ORD-002", status: "shipped", trackingNumber: "1234-5678-9012" },
  { id: 3, orderId: "ORD-003", status: "pending", trackingNumber: "" },
];

const DEMO_TAGS = [
  { value: "urgent", label: "緊急" },
  { value: "important", label: "重要" },
  { value: "review", label: "レビュー待ち" },
  { value: "wip", label: "作業中" },
  { value: "pending", label: "保留" },
  { value: "approved", label: "承認済み" },
];

const DEMO_CATEGORIES = [
  { value: "electronics", label: "電子機器", description: "スマートフォン、PC、タブレットなど" },
  { value: "clothing", label: "衣類", description: "Tシャツ、パンツ、アウターなど" },
  { value: "food", label: "食品", description: "生鮮食品、加工食品、飲料など" },
  { value: "furniture", label: "家具", description: "テーブル、椅子、ソファなど" },
  { value: "books", label: "書籍", description: "小説、ビジネス書、技術書など" },
  { value: "sports", label: "スポーツ", description: "ウェア、シューズ、用具など" },
  { value: "toys", label: "おもちゃ", description: "ゲーム、フィギュア、知育玩具など" },
  { value: "beauty", label: "美容", description: "化粧品、スキンケア、ヘアケアなど" },
  { value: "automotive", label: "自動車", description: "カー用品、パーツ、アクセサリーなど" },
  { value: "garden", label: "ガーデン", description: "植物、ガーデニング用品など" },
];

// SelectPopover用のデモオプション
const DEMO_PRIORITIES = [
  { value: "low", label: "低", description: "通常のタスク" },
  { value: "medium", label: "中", description: "やや重要なタスク" },
  { value: "high", label: "高", description: "重要なタスク" },
  { value: "urgent", label: "緊急", description: "すぐに対応が必要" },
];


export function DemoPopoverDemo() {
  const { showToast } = useToast();
  const [shipments, setShipments] = useState(DEMO_SHIPMENTS);
  const [selectedTags, setSelectedTags] = useState<string[]>(["urgent"]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPriority, setSelectedPriority] = useState("medium");

  // サンプルデータ取得（リレーション展開済み）
  const { data: samples = [], isLoading: isLoadingSamples, mutate: mutateSamples } = useSWR(
    "samples-with-relations",
    () => sampleClient.getAll({ withRelations: true }) as Promise<SampleWithRelations[]>,
  );

  const handleUpdateTracking = useCallback(
    async (id: number, trackingNumber: string) => {
      // 擬似的な非同期処理
      await new Promise((resolve) => setTimeout(resolve, 800));
      setShipments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, trackingNumber } : s))
      );
      showToast(`追跡番号を登録しました: ${trackingNumber}`, "success");
    },
    [showToast]
  );

  const handleDelete = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    showToast("削除しました", "success");
  }, [showToast]);

  const handleAction = useCallback(
    (action: string) => {
      showToast(`${action}を実行しました`, "info");
    },
    [showToast]
  );

  return (
    <Block className="px-6 py-10">
      <Stack gap="xl" className="mx-auto w-full max-w-5xl">
        {/* ヘッダー */}
        <Section as="header" className="my-0 flex flex-col gap-2">
          <PageTitle size="xxxl" className="font-semibold tracking-tight">
            Popover デモ
          </PageTitle>
          <Para tone="muted" size="sm" className="mt-0">
            ポップオーバー系コンポーネントの動作確認ページです。
          </Para>
        </Section>

        {/* Tooltip */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">Tooltip</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              ホバーで短いテキストを表示。アイコンボタンの説明などに使用。
            </Para>
          </Stack>

          <Flex wrap="wrap" gap="md">
            <Tooltip content="設定を開く">
              <Button variant="outline" size="icon">
                <Settings className="size-4" />
              </Button>
            </Tooltip>

            <Tooltip content="メッセージを送信" side="right">
              <Button variant="outline" size="icon">
                <Send className="size-4" />
              </Button>
            </Tooltip>

            <Tooltip content="アーカイブに移動" side="bottom">
              <Button variant="outline" size="icon">
                <Archive className="size-4" />
              </Button>
            </Tooltip>

            <Tooltip content="お気に入りに追加" side="left" delayDuration={0}>
              <Button variant="outline" size="icon">
                <Star className="size-4" />
              </Button>
            </Tooltip>

            <Tooltip content="この操作は取り消せません" side="top">
              <Button variant="destructive" size="sm">
                削除
              </Button>
            </Tooltip>
          </Flex>
        </Section>

        {/* Popover（基本） */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">Popover（基本）</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              汎用的なポップオーバー。タイトル、説明、コンテンツ、フッターを自由に配置可能。
            </Para>
          </Stack>

          <Flex wrap="wrap" gap="md">
            <Popover
              trigger={<Button variant="outline">基本</Button>}
              title="ポップオーバー"
              description="シンプルな説明文を表示できます"
            >
              <Para size="inherit" weight="inherit" align="inherit" className="my-0">ここに任意のコンテンツを配置できます。</Para>
            </Popover>

            <Popover
              trigger={<Button variant="outline">矢印付き</Button>}
              title="矢印付き"
              showArrow
            >
              <Para size="inherit" weight="inherit" align="inherit" className="my-0">矢印でトリガー要素を指し示します。</Para>
            </Popover>

            <Popover
              trigger={<Button variant="outline">閉じるボタン付き</Button>}
              title="閉じるボタン"
              showClose
            >
              <Para size="inherit" weight="inherit" align="inherit" className="my-0">右上に閉じるボタンが表示されます。</Para>
            </Popover>

            <Popover
              trigger={<Button variant="outline">フッター付き</Button>}
              title="フッター付き"
              footer={
                <>
                  <Button size="sm" variant="outline">
                    キャンセル
                  </Button>
                  <Button size="sm">保存</Button>
                </>
              }
            >
              <Para size="inherit" weight="inherit" align="inherit" className="my-0">フッターにボタンを配置できます。</Para>
            </Popover>

            <Popover
              trigger={<Button variant="outline">サイズ: lg</Button>}
              title="大きいサイズ"
              size="lg"
              showArrow
            >
              <Para size="inherit" weight="inherit" align="inherit" className="my-0">size=&quot;lg&quot; で幅が広くなります。</Para>
            </Popover>
          </Flex>
        </Section>

        {/* ConfirmPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">ConfirmPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              確認用ポップオーバー。モーダルより軽量な確認UIを提供。
            </Para>
          </Stack>

          <Flex wrap="wrap" gap="md">
            <ConfirmPopover
              trigger={<Button variant="destructive">削除</Button>}
              title="削除しますか？"
              description="この操作は取り消せません"
              onConfirm={handleDelete}
              confirmVariant="destructive"
              confirmLabel="削除する"
            />

            <ConfirmPopover
              trigger={<Button variant="outline">公開</Button>}
              title="公開しますか？"
              description="この内容が全員に公開されます"
              onConfirm={() => showToast("公開しました", "success")}
              confirmLabel="公開する"
              confirmVariant="primary"
            />

            <ConfirmPopover
              trigger={<Button variant="secondary">非同期処理</Button>}
              title="処理を実行しますか？"
              description="少し時間がかかります"
              onConfirm={async () => {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                showToast("処理が完了しました", "success");
              }}
              confirmLabel="実行"
            />
          </Flex>
        </Section>

        {/* PromptPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">PromptPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              入力用ポップオーバー。単一入力 + 確定ボタンのパターン。
            </Para>
          </Stack>

          <Flex wrap="wrap" gap="md">
            <PromptPopover
              trigger={<Button variant="outline">テキスト入力</Button>}
              title="名前を入力"
              placeholder="山田太郎"
              onConfirm={(value) => showToast(`入力値: ${value}`, "info")}
            />

            <PromptPopover
              trigger={<Button variant="outline">バリデーション付き</Button>}
              title="メールアドレス"
              placeholder="example@example.com"
              inputType="email"
              validation={(v) =>
                v.includes("@") ? null : "有効なメールアドレスを入力してください"
              }
              onConfirm={(value) => showToast(`メール: ${value}`, "success")}
            />

            <PromptPopover
              trigger={<Button variant="outline">複数行入力</Button>}
              title="メモを追加"
              description="任意のメモを入力してください"
              multiline
              rows={4}
              placeholder="ここにメモを入力..."
              onConfirm={(value) => showToast(`メモ: ${value}`, "info")}
            />

            <PromptPopover
              trigger={<Button variant="outline">非同期処理</Button>}
              title="コメントを追加"
              placeholder="コメントを入力..."
              onConfirm={async (value) => {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                showToast(`コメントを保存: ${value}`, "success");
              }}
            />
          </Flex>
        </Section>

        {/* ActionPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">ActionPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              アクションメニュー用ポップオーバー。複数アクションのリスト表示。
            </Para>
          </Stack>

          <Flex wrap="wrap" gap="md">
            <ActionPopover
              trigger={
                <Button variant="outline" size="icon">
                  <MoreVertical className="size-4" />
                </Button>
              }
              actions={[
                { label: "編集", icon: Edit, onClick: () => handleAction("編集") },
                { label: "複製", icon: Copy, onClick: () => handleAction("複製") },
                { type: "separator" },
                {
                  label: "削除",
                  icon: Trash,
                  onClick: () => handleAction("削除"),
                  variant: "destructive",
                },
              ]}
            />

            <ActionPopover
              trigger={<Button variant="secondary">その他の操作</Button>}
              title="アクション"
              actions={[
                { label: "お気に入りに追加", icon: Star, onClick: () => handleAction("お気に入り") },
                { label: "アーカイブ", icon: Archive, onClick: () => handleAction("アーカイブ") },
                { label: "共有", icon: Send, onClick: () => handleAction("共有") },
              ]}
            />

            <ActionPopover
              trigger={<Button variant="outline">非同期アクション</Button>}
              actions={[
                {
                  label: "データを同期",
                  onClick: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                    showToast("同期完了", "success");
                  },
                },
                {
                  label: "キャッシュをクリア",
                  onClick: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 800));
                    showToast("キャッシュをクリアしました", "info");
                  },
                },
              ]}
            />
          </Flex>
        </Section>

        {/* InfoPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">InfoPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              情報・ヘルプ表示用ポップオーバー。?アイコンやiアイコンで詳細説明を表示。
            </Para>
          </Stack>

          <Flex wrap="wrap" align="center" gap="lg">
            <Flex align="center" gap="xs">
              <Span inline>税込価格</Span>
              <InfoPopover title="税込価格について">
                消費税10%を含んだ価格です。軽減税率対象商品は8%で計算されます。
              </InfoPopover>
            </Flex>

            <Flex align="center" gap="xs">
              <Span inline>ステータス</Span>
              <InfoPopover iconType="info" title="ステータスについて">
                <ul className="list-disc pl-4">
                  <li>pending: 処理待ち</li>
                  <li>processing: 処理中</li>
                  <li>completed: 完了</li>
                </ul>
              </InfoPopover>
            </Flex>

            <Flex align="center" gap="xs">
              <Span inline>カスタムトリガー</Span>
              <InfoPopover
                trigger={
                  <Button variant="none" size="none" propagateClick className="text-base font-normal text-primary underline">
                    詳細を見る
                  </Button>
                }
              >
                カスタムトリガーを使用した例です。任意の要素をトリガーにできます。
              </InfoPopover>
            </Flex>
          </Flex>
        </Section>

        {/* ChecklistPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">ChecklistPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              チェックリスト選択用ポップオーバー。タグ選択、カテゴリ割り当てなどに使用。
            </Para>
          </Stack>

          <Flex wrap="wrap" align="start" gap="md">
            <Stack gap="xs">
              <ChecklistPopover
                trigger={<Button variant="outline">タグを選択</Button>}
                title="タグを選択"
                options={DEMO_TAGS}
                value={selectedTags}
                onConfirm={async (values) => {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  setSelectedTags(values);
                  showToast(`${values.length}件のタグを適用しました`, "success");
                }}
              />
              <Block className="text-xs text-muted-foreground">
                選択中: {selectedTags.join(", ") || "なし"}
              </Block>
            </Stack>

            <Stack gap="xs">
              <ChecklistPopover
                trigger={<Button variant="outline">カテゴリ（検索付き）</Button>}
                title="カテゴリを選択"
                description="商品に適用するカテゴリを選択してください"
                options={DEMO_CATEGORIES}
                value={selectedCategories}
                searchable
                showSelectAll
                maxListHeight={200}
                onConfirm={async (values) => {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  setSelectedCategories(values);
                  showToast(`${values.length}件のカテゴリを適用しました`, "success");
                }}
              />
              <Block className="text-xs text-muted-foreground">
                選択中: {selectedCategories.length}件
              </Block>
            </Stack>

            <Stack gap="xs">
              <ChecklistPopover
                trigger={<Button variant="outline">最大3件まで</Button>}
                title="優先タグ（最大3件）"
                options={DEMO_TAGS}
                value={[]}
                maxSelections={3}
                onConfirm={(values) => {
                  showToast(`選択: ${values.join(", ")}`, "info");
                }}
              />
              <Block className="text-xs text-muted-foreground">
                最大選択数の制限
              </Block>
            </Stack>
          </Flex>
        </Section>

        {/* SelectPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">SelectPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              単一選択用ポップオーバー。enumフィールドの変更、ステータス変更などに使用。
            </Para>
          </Stack>

          <Flex wrap="wrap" align="start" gap="md">
            <Stack gap="xs">
              <SelectPopover
                trigger={<Button variant="outline">優先度を選択（確認ボタン付き）</Button>}
                title="優先度を選択"
                description="タスクの優先度を設定してください"
                options={DEMO_PRIORITIES}
                value={selectedPriority}
                onConfirm={async (value) => {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  setSelectedPriority(value);
                  const label = DEMO_PRIORITIES.find((p) => p.value === value)?.label;
                  showToast(`優先度を「${label}」に変更しました`, "success");
                }}
              />
              <Block className="text-xs text-muted-foreground">
                選択中: {DEMO_PRIORITIES.find((p) => p.value === selectedPriority)?.label}
              </Block>
            </Stack>

            <Stack gap="xs">
              <SelectPopover
                trigger={<Button variant="outline">検索付き</Button>}
                title="カテゴリを選択"
                options={DEMO_CATEGORIES}
                value="electronics"
                searchable
                maxListHeight={200}
                onConfirm={(value) => {
                  const label = DEMO_CATEGORIES.find((c) => c.value === value)?.label;
                  showToast(`カテゴリを「${label}」に変更しました`, "success");
                }}
              />
              <Block className="text-xs text-muted-foreground">
                searchable: 検索機能付き
              </Block>
            </Stack>
          </Flex>
        </Section>

        {/* EnumFieldButton with DataTable */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">EnumFieldButton + DataTable</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              サンプルドメインのデータを表示。カテゴリ（BelongsTo）とselectフィールド（Enum）を変更可能。
            </Para>
          </Stack>

          {isLoadingSamples ? (
            <InlineLoader message="読み込み中..." />
          ) : samples.length === 0 ? (
            <Block className="py-8 text-center text-muted-foreground">
              サンプルデータがありません。管理画面からデータを追加してください。
            </Block>
          ) : (
            <RecordSelectionTable<SampleWithRelations>
              items={samples.slice(0, 5)}
              getKey={(item) => item.id}
              maxHeight="400px"
              bulkActions={(selection) => (
                <>
                  <BulkBelongsToFieldButton
                    domain={sampleDisplay}
                    ids={selection.selectedIds}
                    relation="sampleCategory"
                    onSuccess={() => {
                      mutateSamples();
                      selection.clear();
                    }}
                  />
                  <BulkBelongsToManyFieldButton
                    domain={sampleDisplay}
                    ids={selection.selectedIds}
                    relation="sampleTag"
                    showClearAll
                    onSuccess={() => {
                      mutateSamples();
                      selection.clear();
                    }}
                  />
                  <BulkEnumFieldButton
                    domain={sampleDisplay}
                    ids={selection.selectedIds}
                    field="select"
                    onSuccess={() => {
                      mutateSamples();
                      selection.clear();
                    }}
                  />
                  <BulkDeleteButton
                    domain={sampleDisplay}
                    ids={selection.selectedIds}
                    onSuccess={() => {
                      mutateSamples();
                      selection.clear();
                    }}
                  />
                </>
              )}
              columns={[
                {
                  header: "名前",
                  render: (item) => item.name,
                },
                {
                  header: "カテゴリ",
                  render: (item) => item.sample_category?.name ?? "-",
                },
                {
                  header: "タグ",
                  render: (item) =>
                    item.sample_tags && item.sample_tags.length > 0
                      ? item.sample_tags.map((t) => t.name).join(", ")
                      : "-",
                },
                {
                  header: "Select（果物）",
                  render: (item) => item.select ?? "-",
                },
                {
                  header: "作成日",
                  render: (item) =>
                    item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString("ja-JP")
                      : "-",
                },
                {
                  header: "操作",
                  render: (item) => (
                    <Flex className="gap-1">
                      <BelongsToFieldButton
                        domain={sampleDisplay}
                        id={item.id}
                        relation="sampleCategory"
                        currentValue={item.sample_category_id}
                        onSuccess={() => mutateSamples()}
                      />
                      <BelongsToManyFieldButton
                        domain={sampleDisplay}
                        id={item.id}
                        relation="sampleTag"
                        currentValue={item.sample_tag_ids ?? []}
                        showClearAll
                        onSuccess={() => mutateSamples()}
                      />
                      <EnumFieldButton
                        domain={sampleDisplay}
                        id={item.id}
                        field="select"
                        currentValue={item.select ?? ""}
                        onSuccess={() => mutateSamples()}
                      />
                    </Flex>
                  ),
                },
              ]}
            />
          )}
        </Section>

        {/* HoverCard */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">HoverCard</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              ホバープレビュー。リンクやユーザー名にホバーで詳細を表示。
            </Para>
          </Stack>

          <Flex wrap="wrap" gap="lg">
            <HoverCard
              trigger={
                <Span inline tone="primary" className="cursor-pointer underline">
                  @yamada_taro
                </Span>
              }
              openDelay={200}
            >
              <Stack gap="xs">
                <Flex align="center" gap="sm">
                  <Block className="size-10 rounded-full bg-muted" />
                  <Block>
                    <Para size="inherit" weight="semiBold" align="inherit" className="my-0">山田太郎</Para>
                    <Para size="sm" weight="inherit" tone="muted" align="inherit" className="my-0">@yamada_taro</Para>
                  </Block>
                </Flex>
                <Para size="sm" weight="inherit" align="inherit" className="my-0">
                  ソフトウェアエンジニア。React / Next.js が得意です。
                </Para>
                <Flex gap="md" className="text-sm text-muted-foreground">
                  <Span inline>
                    <strong className="text-foreground">123</strong> フォロー中
                  </Span>
                  <Span inline>
                    <strong className="text-foreground">456</strong> フォロワー
                  </Span>
                </Flex>
              </Stack>
            </HoverCard>

            <HoverCard
              trigger={
                <Span inline tone="primary" className="cursor-pointer underline">
                  プロジェクトA
                </Span>
              }
              size="lg"
            >
              <Stack gap="xs">
                <Para size="inherit" weight="semiBold" align="inherit" className="my-0">プロジェクトA</Para>
                <Para size="sm" weight="inherit" tone="muted" align="inherit" className="my-0">
                  次世代ECプラットフォームの開発プロジェクト。2024年Q2リリース予定。
                </Para>
                <Flex gap="xs">
                  <Span size="xs" weight="inherit" tone="primary" className="rounded bg-primary/10 px-2 py-0.5">
                    進行中
                  </Span>
                  <Span size="xs" weight="inherit" className="rounded bg-muted px-2 py-0.5">
                    メンバー: 5名
                  </Span>
                </Flex>
              </Stack>
            </HoverCard>
          </Flex>
        </Section>

        {/* 実践的なユースケース: 発送テーブル */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">実践例: 発送管理テーブル</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              追跡番号の入力にPromptPopoverを使用した例。
            </Para>
          </Stack>

          <DataTable
            items={shipments}
            getKey={(shipment) => shipment.id}
            maxHeight="none"
            columns={[
              { header: "注文ID", render: (shipment) => shipment.orderId },
              {
                header: "ステータス",
                render: (shipment) => (
                  <Span
                    inline
                    size="xs"
                    className={`rounded px-2 py-0.5 ${
                      shipment.status === "shipped"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {shipment.status === "shipped" ? "出荷済み" : "準備中"}
                  </Span>
                ),
              },
              {
                header: "追跡番号",
                render: (shipment) =>
                  shipment.trackingNumber || <Span inline tone="muted">未登録</Span>,
              },
              {
                header: "操作",
                render: (shipment) => (
                  <Flex gap="xs">
                    {shipment.status === "shipped" && (
                      <PromptPopover
                        trigger={
                          <Button size="sm" variant="outline">
                            追跡番号
                          </Button>
                        }
                        title="追跡番号を入力"
                        description="配送業者から通知された追跡番号を入力してください"
                        placeholder="例: 1234-5678-9012"
                        defaultValue={shipment.trackingNumber}
                        validation={(v) =>
                          v.length > 0 ? null : "追跡番号を入力してください"
                        }
                        onConfirm={(value) =>
                          handleUpdateTracking(shipment.id, value)
                        }
                      />
                    )}
                    <ActionPopover
                      trigger={
                        <Button size="sm" variant="ghost">
                          <MoreVertical className="size-4" />
                        </Button>
                      }
                      actions={[
                        {
                          label: "詳細を見る",
                          onClick: () => handleAction("詳細表示"),
                        },
                        {
                          label: "編集",
                          icon: Edit,
                          onClick: () => handleAction("編集"),
                        },
                        { type: "separator" },
                        {
                          label: "キャンセル",
                          icon: Trash,
                          onClick: () => handleAction("キャンセル"),
                          variant: "destructive",
                        },
                      ]}
                    />
                  </Flex>
                ),
              },
            ]}
          />
        </Section>
      </Stack>
    </Block>
  );
}
