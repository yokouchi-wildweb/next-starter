// src/lib/unsavedGuard/types.ts
// 未保存の編集の守りの型(入口 ./index.ts からだけ読む)

/** 確認を出す理由(どの経路の移動か) */
export type LeaveKind = "link" | "anchor" | "push" | "replace" | "back" | "forward" | "popstate";

/**
 * 守っている理由(閉じた一覧。使い手ごとの自由な文は受けない)。
 * - unsaved: 保存していない変更がある(既定。フォーム・表の書きかけ・保存待ち)
 * - inProgress: 処理の途中(取り込み中・アップロード中。離れると中断される)
 */
export type UnsavedReason = "unsaved" | "inProgress";

/** 確認に渡す移動の中身。reasons = いま立っている元の理由(重複なし、UNSAVED_REASONS の順) */
export type LeaveRequest = { readonly kind: LeaveKind; readonly href?: string; readonly reasons: readonly UnsavedReason[] };

/**
 * 確認を出す関数(値で受ける。lib は見た目を持たない)。true = 移る / false = 留まる。
 * アプリの既定は src/wiring が Overlays の Dialog で作って渡す
 */
export type ConfirmLeave = (request: LeaveRequest) => boolean | Promise<boolean>;

/** 編集済みの元(フォームなど)1 つ。set(true) の間は守る、dispose で外す。理由は作る時に決める(既定 unsaved) */
export type UnsavedSource = {
  readonly set: (active: boolean) => void;
  readonly dispose: () => void;
};

/**
 * 終わるまで守る仕事(保存待ちの Promise など)。track(value) は value をそのまま返す。
 * Promise(then を持つ値)なら終わるまで守り、それ以外(void など)は何もしない = 使い手のコールバックの戻り値をそのまま渡せる
 */
export type UnsavedTasks = { readonly track: <T>(task: T) => T };

/** next/navigation の router と同じ形(push / replace / back / forward は編集済みの間に確認する) */
export type GuardedRouter = {
  readonly push: (href: string, options?: { scroll?: boolean }) => void;
  readonly replace: (href: string, options?: { scroll?: boolean }) => void;
  readonly back: () => void;
  readonly forward: () => void;
  readonly refresh: () => void;
  readonly prefetch: (href: string) => void;
};

/** Link の onNavigate に渡す判定(編集済みでなければ undefined = 何もしない) */
export type LinkNavigateJudge = (href: string, options: { readonly replace: boolean; readonly scroll: boolean }) => ((event: { preventDefault: () => void }) => void) | undefined;
