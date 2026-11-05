// src/components/Navigation/Link/index.tsx
// 棚の Link: next/link の包み。口(LinkVisibilityProvider の判定)が「隠す」と答えた href は描かない。
// - gate="auto"(既定): 口の判定に従う / "always": 判定を見ずに描く / "hide": 描かない
// - 判定するのは href が文字列のとき(UrlObject は pathname、無ければ判定しない)
// アプリでは門番が閉じた機能の住所を口に差し込むので、閉じた機能へのリンクが自動で消える。
// 移動の判定は別の口(../NavigationPort): 編集済みの間の確認など(アプリでは src/wiring が未保存の編集の守りを入れる)。詳細: ./README.md

"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

import { useNavigationPort } from "../NavigationPort";
import { useLinkHiddenJudge } from "./context";

export { LinkVisibilityProvider, type LinkHiddenJudge } from "./context";

export type LinkGate = "auto" | "always" | "hide";

export type LinkProps = ComponentProps<typeof NextLink> & {
  /** auto(既定) = 口の判定に従う / always = 常に描く(閉じた機能でも出したいリンクの逃げ道) / hide = 描かない */
  gate?: LinkGate;
};

/** 判定に使う href の文字列(UrlObject は pathname、無ければ null) */
const hrefText = (href: LinkProps["href"]): string | null =>
  typeof href === "string" ? href : (href.pathname ?? null);

export function Link({ gate = "auto", onNavigate, ...props }: LinkProps) {
  const isHidden = useLinkHiddenJudge();
  const port = useNavigationPort();
  if (gate === "hide") return null;
  const text = hrefText(props.href);
  if (gate === "auto" && text !== null && isHidden(text)) return null;
  const judge = text === null ? undefined : port.judgeLink(text, { replace: props.replace === true, scroll: props.scroll !== false });
  const handleNavigate: LinkProps["onNavigate"] =
    judge === undefined
      ? onNavigate
      : (event) => {
          // 呼び手の onNavigate が止めた移動は聞かない
          let prevented = false;
          onNavigate?.({ ...event, preventDefault: () => ((prevented = true), event.preventDefault()) });
          if (!prevented) judge(event);
        };
  return <NextLink {...port.linkAttributes} {...props} onNavigate={handleNavigate} />;
}
