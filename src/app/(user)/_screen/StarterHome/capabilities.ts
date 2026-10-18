// src/app/(user)/_screen/StarterHome/capabilities.ts
// トップページに並べる「このスターターに最初から入っているもの」の一覧。

import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  LayoutDashboard,
  Radio,
  ScrollText,
  ShieldCheck,
  Wallet,
} from "lucide-react";

export type Capability = {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

export const CAPABILITIES: readonly Capability[] = [
  {
    key: "auth",
    icon: ShieldCheck,
    title: "認証とロール",
    description: "Firebase Auth + JWT。ページガード・API 認可・ユーザー同期まで配線済み。",
  },
  {
    key: "domain",
    icon: Blocks,
    title: "データモデル生成",
    description: "モデル定義を書くだけで、entity・service・hook・管理画面が一式生成される。",
  },
  {
    key: "admin",
    icon: LayoutDashboard,
    title: "管理画面",
    description: "一覧・作成・編集・並び替え・一括操作を備えた Admin UI が最初から動く。",
  },
  {
    key: "wallet",
    icon: Wallet,
    title: "ウォレットと決済",
    description: "コイン残高・履歴・決済フロー・クーポンを扱うコアドメイン。",
  },
  {
    key: "audit",
    icon: ScrollText,
    title: "監査ログ",
    description: "CRUD ライフサイクルを自動記録。誰が・何を・いつ変えたかを追える。",
  },
  {
    key: "realtime",
    icon: Radio,
    title: "リアルタイム",
    description: "Firestore 配信と Durable Objects ベースのルーム権威を用途で使い分け。",
  },
] as const;
