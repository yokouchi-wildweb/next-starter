import type { ResponsiveToggle } from "./types"

const responsiveShowClasses: Record<string, string> = {
  sm: "hidden sm:block",
  md: "hidden md:block",
  lg: "hidden lg:block",
  xl: "hidden xl:block",
  "2xl": "hidden 2xl:block",
}

/** ResponsiveToggle をクラス名に変換。boolean 値は undefined を返す（表示/非表示は別 boolean で制御）。 */
export function getResponsiveVisibilityClass(toggle: ResponsiveToggle | undefined): string | undefined {
  return typeof toggle === "string" ? responsiveShowClasses[toggle] : undefined
}

/** ResponsiveToggle が「表示されうる」状態か（false のみ非表示扱い） */
export function isResponsiveToggleVisible(toggle: ResponsiveToggle | undefined): boolean {
  return toggle !== false
}
