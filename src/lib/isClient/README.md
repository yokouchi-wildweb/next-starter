# isClient

クライアントで描画できる状態かを返すフック `useIsClient()`。依存なし(宣言済みの lib: `package.json` の `libs` は空)。設定は持たない。

```tsx
import { useIsClient } from "@/lib/isClient";

const isClient = useIsClient();
if (!isClient) return null;
return createPortal(children, document.body);
```

- SSR とハイドレーション中は `false`、ハイドレーション後は `true`(hydration 不一致を起こさない)
- ハイドレーションを伴わないクライアント側のマウントでは最初の render から `true`
- 使う所: `document.body` へのポータル、サーバーとクライアントで出力が変わるライブラリ(@dnd-kit 等)をハイドレーション後にだけ描く
- `useEffect` で `setMounted(true)` する書き方の置き換え(react-hooks/set-state-in-effect に掛からない)
- 中身は `useSyncExternalStore`(購読なし・クライアントの値 `true`・サーバーの値 `false`)
