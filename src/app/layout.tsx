import type { Metadata } from "next";
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
import { RouteTransitionOverlay } from "@/components/Overlays/Loading/RouteTransition";
import { ImageViewerProvider } from "@/components/Overlays/ImageViewer/Provider";
import { TooltipProvider } from "@/components/Overlays/Tooltip";
import { ViewportHeightWatcher } from "@/components/Fanctional/ViewportHeightWatcher";
import { FirebaseAnalytics } from "@/components/Fanctional/FirebaseAnalytics";
import { MicrosoftClarity } from "@/lib/clarity/MicrosoftClarity";
import { GoogleTag } from "@/lib/googleTag";
import { AuthSessionProvider } from "@/features/core/auth/components/AuthSessionProvider";
import { AdminCommandProvider } from "src/features/core/adminCommand";
import { RecaptchaProvider } from "@/components/Providers/RecaptchaProvider";
import { seoConfig } from "@/config/seo.config";

export const metadata: Metadata = {
  metadataBase: new URL(seoConfig.siteUrl),
  title: {
    default: seoConfig.siteName,
    template: `%s | ${seoConfig.siteName}`,
  },
  description: seoConfig.defaultDescription,
  openGraph: {
    siteName: seoConfig.siteName,
    locale: seoConfig.locale,
    images: [
      {
        url: seoConfig.defaultOgImage,
        width: seoConfig.ogImageSize.width,
        height: seoConfig.ogImageSize.height,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [seoConfig.defaultOgImage],
    site: seoConfig.twitterHandle ? `@${seoConfig.twitterHandle}` : undefined,
    creator: seoConfig.twitterHandle ? `@${seoConfig.twitterHandle}` : undefined,
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
  // 何も読み込んでいなければ空(typography.defaults.css の system スタックで表示)。
  const htmlClassName = [isDark ? "dark" : "", FONTS_CONFIG.className].filter(Boolean).join(" ");

  return (
    <html
      lang="en"
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
        <TooltipProvider>
          <RecaptchaProvider>
            <AuthSessionProvider>
              <AdminCommandProvider>
                <ImageViewerProvider>
                  <RouteTransitionOverlay />
                  {children}
                </ImageViewerProvider>
              </AdminCommandProvider>
            </AuthSessionProvider>
          </RecaptchaProvider>
        </TooltipProvider>
        <RedirectToastProvider />
        {/* Firebase Phone Auth用reCAPTCHAコンテナ（モーダル外に配置が必要） */}
        <div id="phone-verification-recaptcha" />
      </body>
    </html>
  );
}
