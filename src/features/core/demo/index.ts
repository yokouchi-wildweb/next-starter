// src/features/core/demo — デモ(デモモード・デモのログイン・デモ利用者の一覧)。表は持たない(デモ利用者の印は user の列 is_demo)。中身: ./README.md
// 部品の入口は ./components、サーバーの処理は ./services/server/demoLogin(API /api/demo-login が呼ぶ)、hook は ./hooks/useDemoLogin
// 住所の入切は門番の規則 demoPages・demoLogin・adminDemoUsers。このフォルダは基盤(どの規則の domains にも載らない、常時動く proxy の demoMode が読む)

export { demoConfig, type DemoConfig } from "./config";
