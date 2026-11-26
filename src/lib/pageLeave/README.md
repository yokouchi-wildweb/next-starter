# src/lib/pageLeave — ページを離れた時の後片付け(<Activity> の状態の保存の下で、訪れるたびの初期化を戻す)

## Overview

- `next.config` の cacheComponents で、Next は離れたページを `<Activity>` に隠し、状態と ref を保ちます。戻ると effect はもう一度走りますが、ref の守り(`if (doneRef.current) return; doneRef.current = true`)で 1 回にした初期化は、ref が立ったままなので走りません(戻ると前の終わった画面が出る)
- `useOnPageLeave(onLeave)` は、ページを本当に離れた時(隠された・アンマウント)にだけ onLeave を呼びます。そこで ref と状態を戻すと、戻った時の effect が初期化をやり直します
- 開発の StrictMode の作り直し(すぐ戻る)は離れたと見なしません(片付けを次の task へ遅らせ、すぐ戻れば取り消す)。ref の守りが StrictMode の二重実行を防ぐ役も持つ時に、その役を壊しません

## Usage

```ts
const startedRef = useRef(false);
useEffect(() => {
  if (startedRef.current) return;
  startedRef.current = true;
  start();
}, [start]);
useOnPageLeave(() => {
  startedRef.current = false;
  setState(INITIAL_STATE);
});
```

- 使わない物: 戻ってもそのままが正しい物(下書き・スクロール・二重送信の lock・1 回だけの計測の発火)。決まりは `.claude/rules/core/client.md` activity_state、検査は lint `activity/once-ref-guard`

## Related

- Next の文書: `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`
