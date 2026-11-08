// アセットパス取得ユーティリティ
// 配置場所が変わった場合はここを修正する

import type { BusinessValues, LogoVariant } from '@/lib/business'

const ASSET_BASE = '/assets'

export const assetPath = (path: string) => `${ASSET_BASE}/${path}`
export const iconPath = (path: string) => `${ASSET_BASE}/icons/${path}`
export const imgPath = (path: string) => `${ASSET_BASE}/imgs/${path}`
export const videoPath = (path: string) => `${ASSET_BASE}/videos/${path}`
export const sePath = (path: string) => `${ASSET_BASE}/se/${path}`

// ロゴパス取得ユーティリティ。ロゴの定義は事業の素性(@/business の business.logo)を呼び手が渡す
// (utils は事業の素性を読まず引数で受ける、設定の議会 D88 K2)
export const logoPath = (logo: BusinessValues['logo'], variant?: LogoVariant): string => {
  const { variants, defaultVariant } = logo
  const key = variant && variant in variants ? variant : defaultVariant
  return imgPath(variants[key])
}
