// src/app/(user)/demo/popover/page.tsx

"use client";

import { useState, useCallback } from "react";
import { Edit, Copy, Trash, MoreVertical, Settings, Send, Archive, Star } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { PageTitle, Para, SecTitle } from "@/components/TextBlocks";
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
import DataTable from "@/lib/tableSuite/DataTable";
import { EnumFieldButton, BelongsToFieldButton } from "@/lib/crud/components/Buttons";
import { useSampleList } from "@/features/sample/hooks/useSampleList";
import type { Sample } from "@/features/sample/entities";
import { Tooltip } from "@/components/Overlays/Tooltip";
import { HoverCard } from "@/components/Overlays/HoverCard";

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


export default function PopoverDemoPage() {
  const { showToast } = useToast();
  const [shipments, setShipments] = useState(DEMO_SHIPMENTS);
  const [selectedTags, setSelectedTags] = useState<string[]>(["urgent"]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPriority, setSelectedPriority] = useState("medium");

  // サンプルデータ取得（EnumFieldButtonデモ用）
  const { data: samples = [], isLoading: isLoadingSamples } = useSampleList();

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
    <div className="px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
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
          <Stack space={2}>
            <SecTitle as="h2">Tooltip</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              ホバーで短いテキストを表示。アイコンボタンの説明などに使用。
            </Para>
          </Stack>

          <div className="flex flex-wrap gap-4">
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
          </div>
        </Section>

        {/* Popover（基本） */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">Popover（基本）</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              汎用的なポップオーバー。タイトル、説明、コンテンツ、フッターを自由に配置可能。
            </Para>
          </Stack>

          <div className="flex flex-wrap gap-4">
            <Popover
              trigger={<Button variant="outline">基本</Button>}
              title="ポップオーバー"
              description="シンプルな説明文を表示できます"
            >
              <p>ここに任意のコンテンツを配置できます。</p>
            </Popover>

            <Popover
              trigger={<Button variant="outline">矢印付き</Button>}
              title="矢印付き"
              showArrow
            >
              <p>矢印でトリガー要素を指し示します。</p>
            </Popover>

            <Popover
              trigger={<Button variant="outline">閉じるボタン付き</Button>}
              title="閉じるボタン"
              showClose
            >
              <p>右上に閉じるボタンが表示されます。</p>
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
              <p>フッターにボタンを配置できます。</p>
            </Popover>

            <Popover
              trigger={<Button variant="outline">サイズ: lg</Button>}
              title="大きいサイズ"
              size="lg"
              showArrow
            >
              <p>size=&quot;lg&quot; で幅が広くなります。</p>
            </Popover>
          </div>
        </Section>

        {/* ConfirmPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">ConfirmPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              確認用ポップオーバー。モーダルより軽量な確認UIを提供。
            </Para>
          </Stack>

          <div className="flex flex-wrap gap-4">
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
          </div>
        </Section>

        {/* PromptPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">PromptPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              入力用ポップオーバー。単一入力 + 確定ボタンのパターン。
            </Para>
          </Stack>

          <div className="flex flex-wrap gap-4">
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
          </div>
        </Section>

        {/* ActionPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">ActionPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              アクションメニュー用ポップオーバー。複数アクションのリスト表示。
            </Para>
          </Stack>

          <div className="flex flex-wrap gap-4">
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
          </div>
        </Section>

        {/* InfoPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">InfoPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              情報・ヘルプ表示用ポップオーバー。?アイコンやiアイコンで詳細説明を表示。
            </Para>
          </Stack>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span>税込価格</span>
              <InfoPopover title="税込価格について">
                消費税10%を含んだ価格です。軽減税率対象商品は8%で計算されます。
              </InfoPopover>
            </div>

            <div className="flex items-center gap-2">
              <span>ステータス</span>
              <InfoPopover iconType="info" title="ステータスについて">
                <ul className="list-disc pl-4">
                  <li>pending: 処理待ち</li>
                  <li>processing: 処理中</li>
                  <li>completed: 完了</li>
                </ul>
              </InfoPopover>
            </div>

            <div className="flex items-center gap-2">
              <span>カスタムトリガー</span>
              <InfoPopover
                trigger={
                  <button className="text-primary underline">詳細を見る</button>
                }
              >
                カスタムトリガーを使用した例です。任意の要素をトリガーにできます。
              </InfoPopover>
            </div>
          </div>
        </Section>

        {/* ChecklistPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">ChecklistPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              チェックリスト選択用ポップオーバー。タグ選択、カテゴリ割り当てなどに使用。
            </Para>
          </Stack>

          <div className="flex flex-wrap items-start gap-4">
            <div className="flex flex-col gap-2">
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
              <div className="text-xs text-muted-foreground">
                選択中: {selectedTags.join(", ") || "なし"}
              </div>
            </div>

            <div className="flex flex-col gap-2">
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
              <div className="text-xs text-muted-foreground">
                選択中: {selectedCategories.length}件
              </div>
            </div>

            <div className="flex flex-col gap-2">
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
              <div className="text-xs text-muted-foreground">
                最大選択数の制限
              </div>
            </div>
          </div>
        </Section>

        {/* SelectPopover */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">SelectPopover</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              単一選択用ポップオーバー。enumフィールドの変更、ステータス変更などに使用。
            </Para>
          </Stack>

          <div className="flex flex-wrap items-start gap-4">
            <div className="flex flex-col gap-2">
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
              <div className="text-xs text-muted-foreground">
                選択中: {DEMO_PRIORITIES.find((p) => p.value === selectedPriority)?.label}
              </div>
            </div>

            <div className="flex flex-col gap-2">
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
              <div className="text-xs text-muted-foreground">
                searchable: 検索機能付き
              </div>
            </div>
          </div>
        </Section>

        {/* EnumFieldButton with DataTable */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">EnumFieldButton + DataTable</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              サンプルドメインのデータを表示。カテゴリ（BelongsTo）とselectフィールド（Enum）を変更可能。
            </Para>
          </Stack>

          {isLoadingSamples ? (
            <div className="py-8 text-center text-muted-foreground">読み込み中...</div>
          ) : samples.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              サンプルデータがありません。管理画面からデータを追加してください。
            </div>
          ) : (
            <DataTable<Sample>
              items={samples.slice(0, 5)}
              getKey={(item) => item.id}
              maxHeight="400px"
              columns={[
                {
                  header: "名前",
                  render: (item) => item.name,
                },
                {
                  header: "カテゴリ",
                  render: (item) => (
                    <BelongsToFieldButton
                      domain="sample"
                      id={item.id}
                      relation="sampleCategory"
                      currentValue={item.sample_category_id}
                    />
                  ),
                },
                {
                  header: "Select（果物）",
                  render: (item) => (
                    <EnumFieldButton
                      domain="sample"
                      id={item.id}
                      field="select"
                      currentValue={item.select ?? ""}
                    />
                  ),
                },
                {
                  header: "作成日",
                  render: (item) =>
                    item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString("ja-JP")
                      : "-",
                },
              ]}
            />
          )}
        </Section>

        {/* HoverCard */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">HoverCard</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              ホバープレビュー。リンクやユーザー名にホバーで詳細を表示。
            </Para>
          </Stack>

          <div className="flex flex-wrap gap-6">
            <HoverCard
              trigger={
                <span className="cursor-pointer text-primary underline">
                  @yamada_taro
                </span>
              }
              openDelay={200}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-muted" />
                  <div>
                    <p className="font-semibold">山田太郎</p>
                    <p className="text-sm text-muted-foreground">@yamada_taro</p>
                  </div>
                </div>
                <p className="text-sm">
                  ソフトウェアエンジニア。React / Next.js が得意です。
                </p>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">123</strong> フォロー中
                  </span>
                  <span>
                    <strong className="text-foreground">456</strong> フォロワー
                  </span>
                </div>
              </div>
            </HoverCard>

            <HoverCard
              trigger={
                <span className="cursor-pointer text-primary underline">
                  プロジェクトA
                </span>
              }
              size="lg"
            >
              <div className="flex flex-col gap-2">
                <p className="font-semibold">プロジェクトA</p>
                <p className="text-sm text-muted-foreground">
                  次世代ECプラットフォームの開発プロジェクト。2024年Q2リリース予定。
                </p>
                <div className="flex gap-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    進行中
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">
                    メンバー: 5名
                  </span>
                </div>
              </div>
            </HoverCard>
          </div>
        </Section>

        {/* 実践的なユースケース: 発送テーブル */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">実践例: 発送管理テーブル</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              追跡番号の入力にPromptPopoverを使用した例。
            </Para>
          </Stack>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">注文ID</th>
                  <th className="px-4 py-2 text-left font-medium">ステータス</th>
                  <th className="px-4 py-2 text-left font-medium">追跡番号</th>
                  <th className="px-4 py-2 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment) => (
                  <tr key={shipment.id} className="border-b">
                    <td className="px-4 py-3">{shipment.orderId}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          shipment.status === "shipped"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {shipment.status === "shipped" ? "出荷済み" : "準備中"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {shipment.trackingNumber || (
                        <span className="text-muted-foreground">未登録</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
