// src/lib/business — 事業の素性(サービス名・会社・ロゴ・メールの差出人)の型・例・受付係の判定・本番の検査。中身: ./README.md
// 読み手は @/business(src/wiring/business.ts が src/business/business.ts と結ぶ)を読む。この lib を直に読むのは結び・検査・初期化の道具

export { checkBusinessRelease, resolveBusiness, sampleReleaseLevel } from "./business";
export type { BusinessReleaseCheck, SampleReleaseLevel } from "./business";
export { EXAMPLE_BUSINESS } from "./examples/business";
export type { BusinessFile, BusinessSource, BusinessValues, LogoVariant } from "./types";
