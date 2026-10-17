# wallet loaders — page 層が呼ぶサーバー側ロジック

`/wallet` 配下の既定画面（`src/app/(user)/(protected)/wallet/**/_screen/`）と、下流が差し替えた画面の両方が呼ぶ関数です。
page 層に書いていたサーバー側ロジック（slug 解決・認可・取得・redirect / notFound）をここに置くことで、
下流が画面を作り直しても上流の修正（判定条件の変更など）が届き続けます。
仕組み全体と差し替え手順: `src/lib/screens/README.md`

## 一覧（公開契約）

| loader | ルート | 返り値 | redirect / notFound | 画面側が使う hook |
|---|---|---|---|---|
| `loadWalletIndexScreen()` | `/wallet` | `{ wallets: WalletIndexEntry[] }`（`walletType / slug / label`、設定順） | 未ログイン → `/login` | なし（`WalletIndexPage` に `wallets` を渡す） |
| `loadWalletBalanceScreen(props)` | `/wallet/[slug]` | `{ slug, walletType, label, phoneVerifiedAt, phoneNumber }` | 未知 slug → 404 / 未ログイン → `/login` | `useMyWalletBalances`（`WalletBalancePage` 内） |
| `loadWalletHistoryScreen(props)` | `/wallet/[slug]/history` | `{ slug, walletType, label }` | 未知 slug → 404 / 未ログイン → `/login` | `useMyWalletHistoryBatches`（`WalletHistoryPage` 内） |

`props` は `ScreenProps<{ slug: string }>`（`@/lib/screens/types`）。Next が page に渡す props をそのまま渡します。

変更規則（`src/lib/screens/README.md` と同じ）: フィールド追加・optional 引数の追加は自由。改名・非互換変更は旧名を残して新名で追加し、`.notices` で通知。redirect 先や notFound 条件の変更も `.notices` に明記。

## 書き方の規則

- `import "server-only"` を先頭に置く（client component から import するとビルドで止まる）
- React の `cache()` で包む。**キーは引数の同一性**なので、`props` ではなく解決済みのプリミティブ（slug 等）を受ける内側の関数を `cache()` し、公開関数は `await props.params` してから呼ぶ。こうすると `generateMetadata` と Screen が同じ loader を呼んでも解決は 1 回
- `redirect` / `notFound` は loader の責務。結果型（`{ ok: false }` 等）を返す方式は Screen が処理を忘れると fail-open になるので採らない。**Screen 側で loader を try/catch しない**
- 保護ページでも親 layout の `authGuard` に依存せず、自分でも `requireCurrentUser` を呼ぶ（`cache()` 済みで重複コスト無し。機密データの取得をログイン確認なしに行わない）。これは**ログイン確認（セッション + DB レコードの存在）だけ**で、status / role の判定（suspended → `/restricted` 等）は `(protected)/layout.tsx` の `authGuard` が担う
- 返り値は画面が必要とする最小の DTO を**明示的に組み立てる**（`Pick` は実行時に余分なフィールドを落とさない）
- 許容する副作用は画面遷移制御のみ。業務上の更新処理は入れない
- 1 画面 1 loader。共通判定は `utils/` に置いて loader から呼ぶ
- 新しいパスリテラルを増やさない。`"/login"` は `(protected)/layout.tsx` と同じリテラル（定数化は別件）

## 下流が新しい画面を作るとき

loader はそのまま呼び、返り値の DTO だけを使って自由に描いてください。
loader に無いデータが必要なら、まず hook（`features/core/wallet/hooks/`）を確認し、無ければ上流に `/upreq` で loader の返り値追加を依頼するか、自ドメインの loader を別に作ってください（上流の loader を編集しない）。
