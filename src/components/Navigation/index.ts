// Link（next/link の包み。閉じた機能の住所を自動で隠す口 LinkVisibilityProvider）
export { Link, LinkVisibilityProvider } from "./Link"
export type { LinkGate, LinkHiddenJudge, LinkProps } from "./Link"

// PageTab（URL遷移タブ）
export { SolidTabs, UnderlineTabs, useActiveTab, TAB_SIZE_STYLES } from "./PageTab"
export type { PageTabItem, PageTabMatcher, PageTabSize } from "./PageTab"

// StateTabs（状態切り替えタブ）
export { StateTabs, StateTabsContent } from "./StateTabs"
export type { StateTabItem, StateTabSize } from "./StateTabs"

// Pagination
export { default as Pagination } from "./Pagination"
export type { PaginationProps } from "./Pagination"

// NavigationPort（棚の Navigation の口: Link の移動の判定・棚の router・編集済みの元。アプリでは src/wiring が未保存の編集の守りを入れる）
export { NavigationPortProvider, useNavigationPort, useShelfRouter, useShelfUnsavedSource } from "./NavigationPort"
export type { NavigationPortValue, ShelfLinkJudge, ShelfRouter, ShelfUnsavedSource } from "./NavigationPort"
