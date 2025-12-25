// アセットパス取得ユーティリティ
// 配置場所が変わった場合はここを修正する

const ASSET_BASE = '/assets'

export const assetPath = (path: string) => `${ASSET_BASE}/${path}`
export const iconPath = (path: string) => `${ASSET_BASE}/icons/${path}`
export const imgPath = (path: string) => `${ASSET_BASE}/imgs/${path}`
export const videoPath = (path: string) => `${ASSET_BASE}/videos/${path}`
