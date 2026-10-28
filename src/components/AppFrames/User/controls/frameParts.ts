// src/components/AppFrames/User/controls/frameParts.ts
//
// 枠の部位一覧(唯一の元)。Hide* が描く印の属性と、src/styles/frame-controls.generated.css の規則をここから作る。
// 部位や狙う先を変えたら `pnpm frame:generate` で CSS を作り直してコミットする(`--check` と pnpm test:frame-controls が一致を確かめる)。
// 仕組みと経緯: src/app/(user)/_layout/README.md「枠の部位を隠す(Hide* と印)」
//
// 仕組み: Hide* は空の <span hidden data-frame-hide="<部位>-<デバイス>"> を描くだけ(状態・副作用なし)。
// 生成 CSS が「外枠 [data-frame-root] が印を含む間、その部位を display: none、部位の寸法変数(zeroVars)を 0」にする。
// ボトムナビの基本の表示(config の BOTTOM_NAV_VISIBILITY)も、UserLayout が同じ印を描いて作る。
// - server / client どちらの部品から描いても同じ。効くのは印が外枠に入った瞬間(hydration は待たない)
// - 外枠に直接描く印(UserLayout の基本の印)は初回の HTML に入っているので JavaScript なしでも効く。ページ側の印は (user)/loading.tsx(Suspense)の下では
//   本文と一緒に届いた瞬間に効く(loading の間は枠が出る。JavaScript 無効ではストリーミングの本文が外枠に入らず効かない)
// - 印は外枠の中に描く(portal で body 直下へ出すと効かない)
// - 隠す方向だけ・足し算: 印が 1 つでもあれば隠す。={false} は何もしない
//
// "use client" も server-only も付けない(server の Screen からも client 部品からも、生成スクリプトからも読む)。

import { APP_FOOTER_ELEMENT_ID, APP_HEADER_ELEMENT_ID } from "../../constants";

/** デバイスの境界。Tailwind の sm(40rem)と同じ */
export const FRAME_DEVICES = {
  sp: "(width < 40rem)",
  pc: "(width >= 40rem)",
} as const;

export type FrameDevice = keyof typeof FRAME_DEVICES;

/**
 * 隠せる部位。key = 印のトークンと data-frame-part の値(`<key>-<デバイス>` が印のトークン)。
 * ids = 既定部品の id(fork が差し替えた部品も id を残せば従う)。id を変えた部品は外側の要素に `data-frame-part="<key>"` を付ける。
 * zeroVars = 隠している間 0 にする寸法変数(外枠の inline の値に勝つため !important)
 */
export const FRAME_PARTS = {
  header: { ids: [APP_HEADER_ELEMENT_ID], zeroVars: [] },
  "header-nav": { ids: ["header-pc-nav", "header-sp-menu-toggle", "header-sp-nav"], zeroVars: [] },
  footer: { ids: [APP_FOOTER_ELEMENT_ID], zeroVars: [] },
  "bottom-nav": { ids: ["bottom-nav", "bottom-nav-spacer"], zeroVars: ["--app-bottom-nav-height"] },
} as const satisfies Record<string, { readonly ids: readonly string[]; readonly zeroVars: readonly string[] }>;

export type FramePart = keyof typeof FRAME_PARTS;

/** 外枠の属性(この要素の中にある印だけが効く)。Admin も付けられる汎用名 */
export const FRAME_ROOT_ATTR = "data-frame-root";
/** 印の属性(値 = 空白区切りの `<部位>-<デバイス>`) */
export const FRAME_HIDE_ATTR = "data-frame-hide";
/** 部品の属性(値 = 部位の key) */
export const FRAME_PART_ATTR = "data-frame-part";

/** 生成 CSS の目印の変数(styles:check-build が「ビルド出力にこのファイルがある」ことを確かめる名前) */
export const FRAME_CONTROLS_MARKER_VAR = "--frame-controls-generated";

export type FrameHideProps = {
  /** スマホで隠す */
  readonly sp?: boolean;
  /** PC で隠す */
  readonly pc?: boolean;
};

/**
 * Hide* の props → 印のトークン。props 無し = 両方 / sp・pc = true のデバイスだけ / false は何もしない(表示方向は無い)。
 * 隠すデバイスが無ければ空文字
 */
export const frameHideTokens = (part: FramePart, { sp, pc }: FrameHideProps): string => {
  const hideAll = sp === undefined && pc === undefined;
  const devices: FrameDevice[] = [];
  if (hideAll || sp === true) devices.push("sp");
  if (hideAll || pc === true) devices.push("pc");
  return devices.map((device) => `${part}-${device}`).join(" ");
};

const GENERATED_HEADER = `/*
 * src/styles/frame-controls.generated.css
 * 【自動生成ファイル】直接編集しないでください。
 * 生成元: src/components/AppFrames/User/controls/frameParts.ts
 * 再生成: pnpm frame:generate(一致の検査: pnpm frame:generate --check)
 *
 * Hide*(HideHeader 等)が描く印 <span hidden ${FRAME_HIDE_ATTR}="<部位>-<デバイス>"> が
 * 外枠 [${FRAME_ROOT_ATTR}] の中にある間だけ、その部位を display: none にし、部位の寸法変数を 0 にする
 * (client JS なし、隠す方向のみ。変数は外枠の inline に勝つため !important)。
 * layer に入れない = 部品の Tailwind ユーティリティ(sm:flex 等)より優先する。
 */
`;

/** 部位一覧から CSS を作る(生成スクリプトと test が同じ関数を使う) */
export const buildFrameControlsCss = (): string => {
  const blocks = (Object.keys(FRAME_DEVICES) as FrameDevice[]).map((device) => {
    const rules = (Object.keys(FRAME_PARTS) as FramePart[]).map((part) => {
      const root = `[${FRAME_ROOT_ATTR}]:has([${FRAME_HIDE_ATTR}~="${part}-${device}"])`;
      const targets = [...FRAME_PARTS[part].ids.map((id) => `#${id}`), `[${FRAME_PART_ATTR}~="${part}"]`];
      const hide = `  ${root} :is(${targets.join(", ")}) {\n    display: none;\n  }`;
      const zeroVars: readonly string[] = FRAME_PARTS[part].zeroVars;
      const zero = zeroVars.map((name) => `${name}: 0px !important;`).join("\n    ");
      return zero ? `${hide}\n  ${root} {\n    ${zero}\n  }` : hide;
    });
    return `@media ${FRAME_DEVICES[device]} {\n${rules.join("\n")}\n}`;
  });
  const marker = `/* 目印(styles:check-build がビルド出力にこのファイルがあるかをこの名前で確かめる) */\n:root {\n  ${FRAME_CONTROLS_MARKER_VAR}: 1;\n}`;
  return `${GENERATED_HEADER}\n${marker}\n\n${blocks.join("\n\n")}\n`;
};
