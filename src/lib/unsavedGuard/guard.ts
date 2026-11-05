// src/lib/unsavedGuard/guard.ts
// 未保存の編集の守りの本体(React に依らない。window・document・素の router は渡す = test が DOM の道具なしで確かめる)。
// env は呼ぶたびに読む(server の描画では作るだけで window に触れない)。受け止める経路(試作の計測の方式 c + 守り付きの router、./README.md):
// - 棚の Link: onNavigate の判定(judgeLink)。止めて確認し、移るなら元の href へ素の router で進む
// - router.push / replace / back / forward: 守り付きの router(request)
// - 同じオリジンの素の <a>: click の capture(棚の Link が描く <a> は data-navigation-port で見分けて二重に聞かない)
// - 戻る / 進む: popstate の番兵(編集済みになった時に同じ URL の履歴を 1 つ積む。留まるなら積み直す)
// - 再読み込み・タブを閉じる・別のオリジン: beforeunload(ブラウザの確認。文言は変えられない)
// 「移る」を選んだ後は移動が終わるまで聞かない(leaving)。編集済みの元が無くなるか、住所が変わったら戻す。

import type { ConfirmLeave, LeaveRequest, LinkNavigateJudge, UnsavedSource } from "./types";

/** 番兵の履歴の印(history.state に足す。Next の state は残す) */
export const SENTINEL_KEY = "__unsavedGuardSentinel";
/** 棚の Link が描く <a> の印(click の capture が二重に聞かない) */
export const NAVIGATION_PORT_ATTR = "data-navigation-port";

type Listener = (event: never) => void;
type Target = { addEventListener: (type: string, fn: Listener, capture?: boolean) => void; removeEventListener: (type: string, fn: Listener, capture?: boolean) => void };

export type GuardEnv = {
  win: Target & {
    history: { state: unknown; pushState: (state: unknown, unused: string, url?: string) => void; back: () => void };
    location: { href: string; origin: string; pathname: string; search: string };
  };
  doc: Target;
};

/** 素の router(next/navigation の router。移ると決まった後に使う) */
export type RawRouter = {
  push: (href: string, options?: { scroll?: boolean }) => void;
  replace: (href: string, options?: { scroll?: boolean }) => void;
  back: () => void;
  forward: () => void;
};

export type UnsavedGuard = ReturnType<typeof createUnsavedGuard>;

export function createUnsavedGuard({ confirm: initialConfirm, env: getEnv, router: initialRouter }: { confirm?: ConfirmLeave; env: () => GuardEnv; router?: () => RawRouter }) {
  // 確認の関数と素の router は後から入れ替えられる(React の描画の後に最新を入れる、configure)
  let confirm: ConfirmLeave = initialConfirm ?? (() => false);
  let router: () => RawRouter = initialRouter ?? (() => ({ push: () => {}, replace: () => {}, back: () => {}, forward: () => {} }));
  const active = new Set<symbol>();
  const listeners = new Set<() => void>();
  let leaving = false;
  let asking = false;
  let attached = false;

  const isDirty = () => active.size > 0 && !leaving;

  /** 確認して、移るなら proceed。編集済みでなければそのまま進む。確認中の 2 回目は捨てる */
  const request = async (req: LeaveRequest, proceed: () => void): Promise<boolean> => {
    if (!isDirty()) {
      proceed();
      return true;
    }
    if (asking) return false;
    asking = true;
    let ok = false;
    try {
      ok = await confirm(req);
    } finally {
      asking = false;
    }
    if (ok) {
      leaving = true;
      update();
      proceed();
    }
    return ok;
  };

  const pushSentinel = () => {
    const state = getEnv().win.history.state as Record<string, unknown> | null;
    if (state && state[SENTINEL_KEY]) return;
    getEnv().win.history.pushState({ ...(state ?? {}), [SENTINEL_KEY]: true }, "", getEnv().win.location.href);
  };

  const onBeforeUnload = (event: { preventDefault: () => void; returnValue?: unknown }) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  };

  const onClick = (event: {
    defaultPrevented: boolean;
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    target: unknown;
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    if (!isDirty() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as { closest?: (selector: string) => unknown } | null)?.closest?.("a[href]") as
      | { href: string; target?: string; hasAttribute: (name: string) => boolean }
      | null
      | undefined;
    if (!anchor || anchor.hasAttribute(NAVIGATION_PORT_ATTR) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
    const url = new URL(anchor.href, getEnv().win.location.href);
    if (url.origin !== getEnv().win.location.origin) return; // 別のオリジンは beforeunload
    if (url.pathname + url.search === getEnv().win.location.pathname + getEnv().win.location.search) return; // 同じページ内(#)
    event.preventDefault();
    event.stopPropagation();
    const href = url.pathname + url.search + url.hash;
    void request({ kind: "anchor", href }, () => router().push(href));
  };

  const onPopState = () => {
    if (!isDirty()) return;
    void request({ kind: "popstate" }, () => getEnv().win.history.back()).then((ok) => {
      if (!ok) pushSentinel();
    });
  };

  function update() {
    const shouldAttach = isDirty();
    if (shouldAttach && !attached) {
      attached = true;
      pushSentinel();
      getEnv().win.addEventListener("beforeunload", onBeforeUnload as Listener);
      getEnv().doc.addEventListener("click", onClick as Listener, true);
      getEnv().win.addEventListener("popstate", onPopState as Listener);
    } else if (!shouldAttach && attached) {
      attached = false;
      getEnv().win.removeEventListener("beforeunload", onBeforeUnload as Listener);
      getEnv().doc.removeEventListener("click", onClick as Listener, true);
      getEnv().win.removeEventListener("popstate", onPopState as Listener);
    }
    for (const fn of listeners) fn();
  }

  return {
    /** 確認の関数と素の router を入れ替える */
    configure(next: { confirm: ConfirmLeave; router: RawRouter }) {
      confirm = next.confirm;
      router = () => next.router;
    },
    isDirty,
    request,
    /** 編集済みの元を 1 つ作る(フォーム 1 つ = 元 1 つ) */
    createSource(): UnsavedSource {
      const token = Symbol("unsaved");
      return {
        set(on: boolean) {
          if (on) active.add(token);
          else active.delete(token);
          if (active.size === 0) leaving = false;
          update();
        },
        dispose() {
          active.delete(token);
          if (active.size === 0) leaving = false;
          update();
        },
      };
    },
    /** 棚の Link の onNavigate の判定 */
    judgeLink: ((href, { replace, scroll }) => {
      if (!isDirty()) return undefined;
      return (event) => {
        if (!isDirty()) return;
        event.preventDefault();
        void request({ kind: "link", href }, () => (replace ? router().replace(href, { scroll }) : router().push(href, { scroll })));
      };
    }) as LinkNavigateJudge,
    /** 住所が変わった(移動が終わった)= 「移る」の後の聞かない状態を戻す */
    navigated() {
      if (!leaving) return;
      leaving = false;
      update();
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
