// src/domains/core/user/plugs/proxyRedirects/signupMode.ts
// 点 proxyRedirects(src/proxies/extensionPoints.ts)の項目: 新規登録の受付の型(userConfig.signupMode)に合わせた転送の規則
// - earlyRegistration(事前登録): /signup → /entry
// - normal: /entry → /signup
// 未ログインでも転送する(authedOnly: false)。読み手は src/proxies/redirect.ts(同じ sourcePath がほかの規則にあると読み込みで止まる)

import { userConfig } from "@/domains/user/config";
import type { RedirectRuleGroup } from "@/proxies/points";

export const redirects: RedirectRuleGroup =
  userConfig.signupMode === "earlyRegistration"
    ? [{ sourcePaths: ["/signup"], destination: "/entry", authedOnly: false }]
    : [{ sourcePaths: ["/entry"], destination: "/signup", authedOnly: false }];
