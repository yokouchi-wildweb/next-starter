import type { Metadata, Viewport } from "next";
import "@/styles/global.css";
import { Suspense } from "react";
import { headers } from "next/headers";

import { SiteThemeSync } from "@/components/Fanctional/SiteThemeSync";
import { FONTS_CONFIG } from "@/config/ui/fonts.config";
import { SITE_THEME_CONFIG } from "@/config/ui/site-theme.config";
import {
  buildSiteThemeBootstrapScript,
  resolveSiteTheme,
  SITE_THEME_AREA_ATTRIBUTE,
} from "@/lib/siteTheme";
import { GlobalScreenLoader } from "@/components/Overlays/Loading/GlobalScreenLoader";
import { GlobalToast, RedirectToastProvider } from "@/lib/toast";
import { ViewportHeightWatcher } from "@/components/Fanctional/ViewportHeightWatcher";
import { FirebaseAnalytics } from "@/components/Fanctional/FirebaseAnalytics";
import { MicrosoftClarity } from "@/lib/clarity";
import { GoogleTag } from "@/wiring/GoogleTag";
import { business } from "@/business";
import { AppProviders } from "@/wiring/AppProviders";
import { clientGateState } from "@/featureGate";

import { ROOT_LAYOUT_CONFIG } from "./_layout/config";

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
const siteThemeBootstrapScript = buildSiteThemeBootstrapScript(SITE_THEME_CONFIG);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // サイトテーマ: proxy.ts が付与した x-pathname からエリアを判定し、<html> に dark クラスと
  // data-area を SSR で出力する(初回描画がエリアの既定で確定する)。保存値と OS 設定は SSR では
  // 分からないので <head> の bootstrap script が body 描画前に補正し、以後は SiteThemeSync が
  // クライアント遷移・切替操作・OS 設定変化のたびに再解決する。
  // 判定ロジックは @/lib/siteTheme に一本化(設定: src/config/ui/site-theme.config.ts)。
  // proxy ハンドラが rewrite で intercept した場合は x-pathname が無く fallback エリア扱いになるが、
  // bootstrap script が location.pathname で描画前に補正するので実害はない。
  const pathname = (await headers()).get("x-pathname") ?? "/";
  const { area, isDark } = resolveSiteTheme(SITE_THEME_CONFIG, {
    pathname,
    stored: null,
    systemPrefersDark: false,
  });

  // 書体: fonts.config.ts(next/font)で読み込んだフォントの variable クラスを <html> に当てる。
  // 何も読み込んでいなければ空(typography.default.css の system スタックで表示)。
  const htmlClassName = [isDark ? "dark" : "", FONTS_CONFIG.className].filter(Boolean).join(" ");

  return (
    <html
      lang={business.htmlLang}
      suppressHydrationWarning
      className={htmlClassName || undefined}
      {...{ [SITE_THEME_AREA_ATTRIBUTE]: area.key }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: siteThemeBootstrapScript }} />
      </head>

      <body suppressHydrationWarning className="antialiased font-sans">
        <SiteThemeSync />
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
        <AppProviders gate={clientGateState("user")}>
          {children}
        </AppProviders>
        <RedirectToastProvider />
        {/* Firebase Phone Auth用reCAPTCHAコンテナ（モーダル外に配置が必要） */}
        <div id="phone-verification-recaptcha" />
      </body>
    </html>
  );
}
