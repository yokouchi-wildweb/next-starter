// src/utils/xShare.ts
//
// X（Twitter）の投稿インテントを開く共通ユーティリティ。
//
// 全プラットフォームで公式の Web インテント（x.com/intent/post）を開く。
// アプリがインストールされていれば OS の App Links / Universal Links により
// X アプリのコンポーザーが開き、なければ Web の投稿画面が開く。
//
// 【重要】モバイルでのアプリスキーム直叩き（twitter://post?message= /
// intent://post...scheme=twitter）は使わないこと。非公式スキームのため
// X アプリのバージョンによって本文（message パラメータ）が無視され、
// コンポーザーが空で開く事象が実際に発生した（2026-08 下流プロダクトで
// 本文中の識別子・ハッシュタグを自動検証する機能が欠落本文により破損）。
// 本文プリフィルの確実性を最優先し、アプリ起動は OS に委ねる。
// なお twitter.com はリダイレクトを挟み App Links が不発になるため
// x.com 直指定を維持する。

/** 投稿インテントURL（x.com 直指定。リダイレクトを挟むと App Links が発火しないため twitter.com は使わない） */
export function buildXPostIntentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/**
 * 投稿本文を X のコンポーザーで開く。
 * 公式 Web インテントを新規タブで開く（アプリ起動は OS の App Links に委ねる）。
 */
export function openXPostIntent(text: string): void {
  window.open(buildXPostIntentUrl(text), "_blank", "noopener,noreferrer");
}
