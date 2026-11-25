// src/lib/screens/index.ts
// 入口 ".": 画面の作り手の汎用版(createScreenMaker。設定済み版は @/wiring/screen)、画面の props の型(Screen と loader が受け取る ScreenProps)と構造の検査の設定。中身: ./README.md
// 構造の検査の部品(字面の検査関数・src/app のページの発見(node:fs)・ルート地図)は入口 "./node"(./node.mjs、道具だけが読む)

export { createScreenMaker } from "./createScreen";
export type { CreateScreen, CreatedScreen, ScreenConfig, ScreenLoad, ScreenMakerConfig, ScreenMetadata } from "./createScreen";
export type { ScreenProps, ScreenSearchParams } from "./types";
export type { ScreensConfig, ScreensOverride } from "./config";
export { screensConfig } from "./config";
