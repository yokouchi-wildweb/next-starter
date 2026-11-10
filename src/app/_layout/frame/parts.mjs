// src/app/_layout/frame/parts.mjs
// 枠の部位の一覧(唯一の元)と、宣言(frame.ts)を持つ枠の根。生成器(scripts/structure/extensions/frames.mjs)も実行時の読み手も、
// 部位の一覧のテスト(./parts.test.mjs)もここを引く。.mjs なのは、tsx を通さない生成器(node)からも TypeScript からも import するため。
// 名前 = 枠の部位に付ける data-slot の値(余白の議会 D12・D20 の一覧、31 名)。部位の印は data-slot だけ(隠す CSS src/styles/core/frame.css も
// [data-slot="<部位>"] を読む)。利用者の枠は接頭辞なし、管理の枠は admin-。
// 隠せる部位(hideable)だけが frame.ts の hide に書ける。hideSlots = その部位を隠す data-slot の名前(隠す CSS src/styles/core/frame.css は
// これだけで隠せる。今は全部が部位の名前 1 つ: 包み(display: contents)やスペーサーも同じ名前を持つ)。CSS の id は一時の橋(frame.css の説明)。
// 宣言のキー = 名前から枠の接頭辞を除いた camelCase(admin の header → admin-header)。
// 見出しの名前(area "heading")は見出しの部品が付ける(source = その印を描く部品のファイル。描いた印と一覧の照合は
// src/components/TextBlocks/headingSlots.test.tsx、枠の中の source は各枠の照合にも入る)。見出しの印も約束: 消す・名前を変えるのは notice。書式と仕組み: ./README.md

/**
 * @typedef {"user" | "admin" | "main" | "heading"} FrameSlotArea
 * @typedef {{ readonly name: string, readonly area: FrameSlotArea, readonly hideable?: true, readonly hideSlots?: readonly string[], readonly source?: string }} FrameSlot
 */

/** @type {readonly FrameSlot[]} */
export const FRAME_SLOTS = [
  // 利用者の枠(src/app/(user)/_layout)
  { name: "app-container", area: "user" },
  { name: "app-banner", area: "user" },
  { name: "header", area: "user", hideable: true, hideSlots: ["header"] },
  { name: "header-shell", area: "user" },
  { name: "header-left", area: "user" },
  { name: "header-center", area: "user" },
  { name: "header-right", area: "user" },
  { name: "header-brand", area: "user" },
  { name: "header-brand-logo", area: "user" },
  { name: "header-brand-text", area: "user" },
  { name: "header-nav", area: "user", hideable: true, hideSlots: ["header-nav"] },
  { name: "header-sp-nav-panel", area: "user" },
  { name: "footer", area: "user", hideable: true, hideSlots: ["footer"] },
  { name: "bottom-nav", area: "user", hideable: true, hideSlots: ["bottom-nav"] },
  { name: "bottom-nav-item", area: "user" },
  // 管理の枠(src/app/admin/_layout・admin/(protected)/_layout)
  { name: "admin-app-container", area: "admin" },
  { name: "admin-header", area: "admin", hideable: true, hideSlots: ["admin-header"] },
  { name: "admin-header-title", area: "admin" },
  { name: "admin-header-center", area: "admin" },
  { name: "admin-header-right", area: "admin" },
  { name: "admin-sidebar", area: "admin", hideable: true, hideSlots: ["admin-sidebar"] },
  { name: "admin-main", area: "admin" },
  { name: "admin-footer", area: "admin", hideable: true, hideSlots: ["admin-footer"] },
  // Main(src/components/Layout/Main.tsx。両方の枠で使う)
  { name: "main", area: "main" },
  { name: "main-layout", area: "main" },
  { name: "main-container", area: "main" },
  // 見出し(source = 印を描く部品のファイル)
  { name: "user-page-title", area: "heading", source: "src/app/(user)/_layout/PageTitle.tsx" },
  { name: "page-title", area: "heading", source: "src/components/TextBlocks/PageTitle.tsx" },
  { name: "admin-page-title", area: "heading", source: "src/app/admin/_layout/AdminPageTitle.tsx" },
  { name: "sec-title", area: "heading", source: "src/components/TextBlocks/SecTitle.tsx" },
  { name: "admin-sec-title", area: "heading", source: "src/components/AppFrames/Admin/Elements/SecTitle.tsx" },
];

/**
 * 宣言を持つ枠の根。dir = 枠の layout のフォルダ(表の pattern はこの下の segment)、表は <dir>/_layout/extensions/frameTable.ts
 * @type {Readonly<Record<"user" | "admin", { readonly dir: string, readonly area: "user" | "admin", readonly prefix: string }>>}
 */
export const FRAME_ROOTS = {
  user: { dir: "src/app/(user)", area: "user", prefix: "" },
  admin: { dir: "src/app/admin", area: "admin", prefix: "admin-" },
};

/** 端末(sp = 40rem 未満 / pc = 40rem 以上。Tailwind の sm と同じ) */
export const FRAME_DEVICES = /** @type {const} */ (["sp", "pc"]);

const camel = (kebab) => kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/**
 * 枠の隠せる部位(宣言のキー → 部位の名前)。並びは一覧の順
 * @param {"user" | "admin"} root
 * @returns {{ key: string, slot: string, hideSlots: readonly string[] }[]}
 */
export function hideableParts(root) {
  const { area, prefix } = FRAME_ROOTS[root];
  return FRAME_SLOTS.filter((s) => s.area === area && s.hideable).map((s) => ({ key: camel(s.name.slice(prefix.length)), slot: s.name, hideSlots: s.hideSlots ?? [s.name] }));
}
