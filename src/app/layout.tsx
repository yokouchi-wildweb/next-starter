import type { Metadata, Viewport } from "next";
import "@/styles/global.css";
import { Suspense } from "react";

import { fontsConfig } from "@/lib/fonts";
import { buildSiteThemeBootstrapScript, siteThemeConfig, SiteThemeSync } from "@/lib/siteTheme";
import { GlobalScreenLoader } from "@/lib/globalLoader";
import { GlobalToast, RedirectToastProvider } from "@/lib/toast";
import { ViewportHeightWatcher } from "@/lib/viewport";
import { Block } from "@/components/Layout/Block";
import { MicrosoftClarity } from "@/lib/clarity";
import { GoogleTag } from "@/wiring/GoogleTag";
import { business } from "@/business";
import { AppProviders } from "@/wiring/AppProviders";
import { clientGateState } from "@/featureGate";

import { ROOT_LAYOUT_CONFIG } from "./_layout/config";
import { FirebaseAnalytics } from "./_mounts/FirebaseAnalytics";

// viewport は root の枠の設定(src/app/_layout/config.ts、上書き src/config/layout/root.config.ts)
export const viewport: Viewport = ROOT_LAYOUT_CONFIG.viewport;

// サイト名・URL・説明・OGP・言語は事業の素性(@/business)
const { seo } = business;
const twitterAccount = seo.twitterHandle ? `@${seo.twitterHandle}` : undefined;

export const metadata: Metadata = {
  metadataBase: new URL(business.url),
  title: {
    default: business.serviceNameShort,
    template: `%s | ${business.serviceNameShort}`,
  },
  description: business.description,
  openGraph: {
    siteName: business.serviceNameShort,
    locale: seo.locale,
    images: [
      {
        url: seo.defaultOgImage,
        width: seo.ogImageSize.width,
        height: seo.ogImageSize.height,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [seo.defaultOgImage],
    site: twitterAccount,
    creator: twitterAccount,
  },
};

// 設定は静的なので bootstrap script はモジュール評価時に 1 回だけ生成する
const siteThemeBootstrapScript = buildSiteThemeBootstrapScript(siteThemeConfig);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // サイトテーマ: <html> の dark クラスと data-area は <head> の bootstrap script が body の描画前に決める
  // (location.pathname・保存値・OS 設定から。初回描画のフラッシュなし)。以後は SiteThemeSync が
  // クライアント遷移・切替操作・OS 設定変化のたびに再解決する。root layout は request(headers)を読まない
  // (どのページも同じ静的な殻を出せるように)。判定ロジックは @/lib/siteTheme に一本化
  // (設定の上書き: src/config/lib/siteTheme.config.ts)。

  // 書体: fonts.config.ts(next/font)で読み込んだフォントの variable クラスを <html> に当てる。
  // 何も読み込んでいなければ空(core/typography.css の system スタックで表示)。
  const htmlClassName = fontsConfig.className;

  return (
    <html
      lang={business.htmlLang}
      suppressHydrationWarning
      className={htmlClassName || undefined}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: siteThemeBootstrapScript }} />
      </head>

      <body suppressHydrationWarning className="antialiased font-sans">
        {/* 殻の外へ: URL を読む葉(usePathname)と Provider(セッション・門番)の下は request ごとに流し込む。fallback null = 見た目は変えない */}
        <Suspense fallback={null}>
          <SiteThemeSync />
        </Suspense>
        <Suspense fallback={null}>
          <FirebaseAnalytics />
        </Suspense>
        <Suspense fallback={null}>
          <MicrosoftClarity />
        </Suspense>
        <GoogleTag />
        <ViewportHeightWatcher />
        <GlobalScreenLoader />
        <GlobalToast />
        {/* Provider の入れ子は src/wiring/AppProviders.tsx(Tooltip → reCAPTCHA → 認証セッション → 管理コマンド → 画像ビューア) */}
        {/* 門番の client への受け渡し: 利用者の枠の値をここで計算して渡す(管理の枠は admin の守りの layout が包み直す) */}
        <Suspense fallback={null}>
          <AppProviders gate={clientGateState("user")}>
            {children}
          </AppProviders>
        </Suspense>
        <Suspense fallback={null}>
          <RedirectToastProvider />
        </Suspense>
        {/* Firebase Phone Auth用reCAPTCHAコンテナ（モーダル外に配置が必要） */}
        <Block id="phone-verification-recaptcha" />
      </body>
    </html>
  );
}
