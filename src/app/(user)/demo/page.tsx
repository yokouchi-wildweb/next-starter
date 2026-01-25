import Link from "next/link";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Main, PageTitle, Para } from "@/components/TextBlocks";

const DEMO_PAGES = [
  { path: "block-appearance", label: "Block Appearance", description: "ブロック要素の外観設定" },
  { path: "check-env", label: "Check Env", description: "環境変数の確認" },
  { path: "dummy-payment", label: "Dummy Payment", description: "ダミー決済フロー" },
  { path: "field-layout", label: "Field Layout", description: "フィールドレイアウトのデモ" },
  { path: "form-components", label: "Form Components", description: "フォームコンポーネント一覧" },
  { path: "google-popup", label: "Google Popup", description: "Google認証（ポップアップ）" },
  { path: "google-redirect", label: "Google Redirect", description: "Google認証（リダイレクト）" },
  { path: "media-input", label: "Media Input", description: "メディアアップロード" },
  { path: "overlay", label: "Overlay", description: "モーダル・ダイアログ" },
  { path: "popover", label: "Popover", description: "ポップオーバー" },
  { path: "slider", label: "Slider", description: "スライダーコンポーネント" },
  { path: "sortable-list", label: "Sortable List", description: "並び替え可能なリスト" },
  { path: "status-badge", label: "Status Badge", description: "ステータスバッジ" },
  { path: "tables", label: "Tables", description: "テーブルコンポーネント" },
] as const;

export default function DemoIndexPage() {
  return (
    <Main containerType="wide">
      <Section>
        <Stack space={6}>
          <PageTitle size="xxl" className="font-semibold">
            デモ一覧
          </PageTitle>
          <Para tone="muted" size="sm">
            各コンポーネントのデモページへのリンク集です。
          </Para>
        </Stack>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_PAGES.map((page) => (
            <Link
              key={page.path}
              href={`/demo/${page.path}`}
              className="group block rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
            >
              <Para weight="medium" className="text-foreground group-hover:text-accent-foreground">
                {page.label}
              </Para>
              <Para size="sm" tone="muted" className="group-hover:text-accent-foreground">
                {page.description}
              </Para>
            </Link>
          ))}
        </div>
      </Section>
    </Main>
  );
}
