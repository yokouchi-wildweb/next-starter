/**
 * カラー形式の相互変換ユーティリティ
 * - CSS hex: #000000 または 000000
 * - Code hex: 0x000000
 * - RGB: 0, 0, 0
 */

export type RGB = { r: number; g: number; b: number }
export type CssHexOptions = { withHash?: boolean }

// ============================================================
// パーサー（各形式 → RGB オブジェクト）
// ============================================================

/** #000000, 000000, #000, 000 → RGB（#の有無どちらでも可） */
export const parseCssHex = (hex: string): RGB => {
  const clean = hex.replace('#', '')
  const expanded = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  }
}

/** 0x000000 → RGB */
export const parseCodeHex = (hex: string): RGB => {
  const clean = hex.replace('0x', '').replace('0X', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

/** "0, 0, 0" または "0,0,0" → RGB */
export const parseRgbString = (rgb: string): RGB => {
  const parts = rgb.split(',').map((s) => parseInt(s.trim(), 10))
  return { r: parts[0], g: parts[1], b: parts[2] }
}

// ============================================================
// フォーマッター（RGB オブジェクト → 各形式）
// ============================================================

/** RGB → #000000 または 000000（withHash: false で # なし） */
export const rgbToCssHex = ({ r, g, b }: RGB, options?: CssHexOptions): string => {
  const { withHash = true } = options ?? {}
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  const hex = `${toHex(r)}${toHex(g)}${toHex(b)}`
  return withHash ? `#${hex}` : hex
}

/** RGB → 0x000000 */
export const rgbToCodeHex = ({ r, g, b }: RGB): string => {
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `0x${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** RGB → "0, 0, 0" */
export const rgbToString = ({ r, g, b }: RGB): string => {
  return `${r}, ${g}, ${b}`
}

// ============================================================
// 直接変換（ショートカット）
// ============================================================

/** #000000 または 000000 → 0x000000 */
export const cssHexToCodeHex = (hex: string): string => {
  return rgbToCodeHex(parseCssHex(hex))
}

/** 0x000000 → #000000 または 000000（withHash: false で # なし） */
export const codeHexToCssHex = (hex: string, options?: CssHexOptions): string => {
  return rgbToCssHex(parseCodeHex(hex), options)
}

/** #000000 または 000000 → "0, 0, 0" */
export const cssHexToRgbString = (hex: string): string => {
  return rgbToString(parseCssHex(hex))
}

/** "0, 0, 0" → #000000 または 000000（withHash: false で # なし） */
export const rgbStringToCssHex = (rgb: string, options?: CssHexOptions): string => {
  return rgbToCssHex(parseRgbString(rgb), options)
}

/** 0x000000 → "0, 0, 0" */
export const codeHexToRgbString = (hex: string): string => {
  return rgbToString(parseCodeHex(hex))
}

/** "0, 0, 0" → 0x000000 */
export const rgbStringToCodeHex = (rgb: string): string => {
  return rgbToCodeHex(parseRgbString(rgb))
}

// ============================================================
// 形式判定（チェッカー）
// ============================================================

export type ColorFormat = 'cssHex' | 'codeHex' | 'rgbString'

/** #000000, 000000, #000, 000 形式かどうか */
export const isCssHex = (value: string): boolean => {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
}

/** 0x000000 形式かどうか */
export const isCodeHex = (value: string): boolean => {
  return /^0[xX][0-9a-fA-F]{6}$/.test(value)
}

/** "0, 0, 0" または "0,0,0" 形式かどうか（各値0-255） */
export const isRgbString = (value: string): boolean => {
  const match = value.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/)
  if (!match) return false
  const [, r, g, b] = match.map(Number)
  return r <= 255 && g <= 255 && b <= 255
}

/** 入力文字列がどの形式かを判定（該当なしは null） */
export const detectColorFormat = (value: string): ColorFormat | null => {
  if (isCodeHex(value)) return 'codeHex'
  if (isCssHex(value)) return 'cssHex'
  if (isRgbString(value)) return 'rgbString'
  return null
}
