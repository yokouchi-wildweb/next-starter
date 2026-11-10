// src/features/core/demo — デモ(デモモード・デモのログイン・デモ利用者の管理)。表は持たない(デモ利用者の印は user の列 is_demo)。中身: ./README.md
// 住所の入切は門番の規則 demoPages・demoLogin・adminDemoUsers。このフォルダは基盤(どの規則の domains にも載らない、常時動く proxy の demoMode が読む)

export { demoConfig, type DemoConfig } from "./config";
