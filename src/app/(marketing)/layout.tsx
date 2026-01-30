import type { ReactNode } from "react";

// マーケティング用レイアウト（LP、料金ページ、機能紹介など）
// TODO: マーケティング専用のヘッダー・フッターを追加

export default function MarketingLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
