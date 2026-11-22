// src/domains/core/auth/plugs/rootProviders/authSession.tsx
// 点 rootProviders(アプリ全体を包む Provider、宣言 src/app/_layout/extensionPoints.ts)の項目: 認証セッション(段 session)。
// 入れ子は src/wiring/AppProviders.tsx。データに届く(Cookie の解析とセッション解決): ページのデータ・セッションを読む場所の名前付き例外


import { AuthSessionProvider } from "../../components/AuthSessionProvider";
import type { RootProvider } from "@/app/_layout/points";

export const stage = "session";

export const provider: RootProvider = AuthSessionProvider;
