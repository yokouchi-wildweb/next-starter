// src/app/_layout/frame/types.ts
// 枠の宣言(frame.default.ts / frame.ts)と生成した表の型。キーの union は ./parts.mjs の hideableParts と同じ(./parts.test.mjs が照らす)。
// 書き方: export const frame = { page: { hide: { bottomNav: { sp: true } } } } satisfies FrameDeclaration;(ルートを作ったリポの既定は frameDefault。admin の下は AdminFrameDeclaration)

/** 端末ごとの隠す指定(省略 = 親のまま、false = 親の指定の取り消し) */
export type FramePartSetting = { readonly sp?: boolean; readonly pc?: boolean };

/** 利用者の枠(src/app/(user))の隠せる部位 */
export type UserFrameKey = "header" | "headerNav" | "footer" | "bottomNav";
/** 管理の枠(src/app/admin)の隠せる部位 */
export type AdminFrameKey = "header" | "sidebar" | "footer";

/** 1 つの範囲の値 */
type Value<K extends string> = {
  readonly hide?: Partial<Record<K, FramePartSetting>>;
  /** 外枠を画面の高さに合わせ、本文が残りを埋める */
  readonly fill?: boolean;
};

/** 範囲はキーで名指す: layout = 隣の layout.tsx の下全部 / page = 隣の page.tsx だけ(子のルートに継がない) */
type Declaration<K extends string> = {
  readonly layout?: Value<K>;
  readonly page?: Value<K>;
};

/** 利用者の枠の 1 つの範囲の値 */
export type FrameValue = Value<UserFrameKey>;
/** 管理の枠の 1 つの範囲の値 */
export type AdminFrameValue = Value<AdminFrameKey>;
/** 利用者の枠の宣言(frame.default.ts の frameDefault・frame.ts の frame) */
export type FrameDeclaration = Declaration<UserFrameKey>;
/** 管理の枠の宣言 */
export type AdminFrameDeclaration = Declaration<AdminFrameKey>;

/** 生成した表の 1 行(解決済みの最終の値) */
export type FrameTableRow = {
  /** 枠の layout の下の segment(ルートグループを含む、動的な段は [id] のまま) */
  readonly pattern: readonly string[];
  /** layout = その下全部 / page = そのページだけ */
  readonly scope: "page" | "layout";
  /** 隠す印 `<部位>-<sp|pc>` */
  readonly hide: readonly string[];
  readonly fill: boolean;
};

export type FrameTable = readonly FrameTableRow[];

/** 枠の根(外枠)に付ける属性(./useFrameAttributes.ts)。data-frame-hide = 隠す印 `<部位>-<sp|pc>` の空白区切り、data-frame-fill = 本文が残りの高さを埋める */
export type FrameAttributes = {
  readonly "data-frame-hide"?: string;
  readonly "data-frame-fill"?: "";
};
