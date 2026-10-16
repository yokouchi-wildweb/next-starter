// src/lib/siteTheme/bootstrapScript.ts
//
// <head> に同期で埋め込む初期化スクリプトを生成する。
// SSR では localStorage の保存値と OS 設定が分からないため、
// body の描画前にクライアント側で resolve.ts と同じ判定をやり直し、
// `<html>` の dark クラスと data-area を確定させる(初回描画のフラッシュ防止)。
//
// 下流はこのファイルを触らない。設定は引数で受け取り JSON として埋め込む。
// ロジックは resolve.ts の手書き複製であり、siteTheme.test.mjs が両者の一致を検証する。

import type { SiteThemeConfig } from "./types";

/** `</script>` によるインジェクションを防ぐため `<` をエスケープした JSON */
function toInlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** `<html data-area>` 属性名。CSS の `[data-area="..."]` と対応 */
export const SITE_THEME_AREA_ATTRIBUTE = "data-area";

export function buildSiteThemeBootstrapScript(config: SiteThemeConfig): string {
  const payload = toInlineJson({
    storageKey: config.storageKey,
    areas: config.areas.map((a) => ({
      key: a.key,
      match: a.match,
      mode: a.mode,
      switchable: a.switchable,
    })),
    fallback: config.fallback,
  });

  // 旧ブラウザ互換のため var / function 構文。例外時は SSR の状態をそのまま使う(fail silent)。
  return `(function(){try{var c=${payload};var p=location.pathname;var a=null;for(var i=0;i<c.areas.length&&!a;i++){var ar=c.areas[i];for(var j=0;j<ar.match.length;j++){var m=ar.match[j];if(m==="/"||p===m||p.indexOf(m+"/")===0){a=ar;break}}}if(!a){a=c.fallback}var s=null;if(a.switchable){try{s=localStorage.getItem(c.storageKey)}catch(e){}}var d;if(s==="dark"||s==="light"){d=s==="dark"}else if(a.mode==="system"){d=!!(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)}else{d=a.mode==="dark"}var r=document.documentElement;if(d){r.classList.add("dark")}else{r.classList.remove("dark")}r.setAttribute("${SITE_THEME_AREA_ATTRIBUTE}",a.key)}catch(e){}})();`;
}
