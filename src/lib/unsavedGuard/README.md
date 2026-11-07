# unsavedGuard — 未保存の編集の守り

編集済み(フォームを変えて保存していない)の間に、ページを離れる移動を止めて確認を出す。「移る」なら元の移動がそのまま続き、「留まる」なら画面も住所もそのまま。

## 入口と依存(閉じた lib)

- 入口は `index.ts` だけ(中のファイルを外から読まない)
- 読む物: `react`、`next/navigation`(`useRouter`・`usePathname`。`useRouter` を読むのはこの lib の中だけ = lint `import-boundaries/router-via-guard` の例外)
- 読まない物: features・棚(src/components)・ほかの lib。確認の見た目は持たず、確認の関数を値で受ける
- 読む lib(使い手): `dataMigration`(取り込み中)・`mediaInputSuite`(アップロード中)・`tableSuite`(EditableGridTable の書きかけ・保存待ち)・`sortableList`(並びの保存待ち)。どれも `guardUnsaved`(既定 true)で外せる。棚の AppForm は棚の Navigation の口から(D50)

## 使い方

```tsx
// アプリの結線(src/app/_layout/unsavedGuard/UnsavedGuardRoot.tsx が AppProviders の中で 1 か所)
<UnsavedGuardProvider confirm={(request) => openDialog(request)}>{children}</UnsavedGuardProvider>

// 編集済みの間守る(AppForm は既定で入る。ほかの編集画面はこれを呼ぶ)
useUnsavedGuard(formState.isDirty);
// 処理の途中(取り込み中・アップロード中)は理由を変える = 確認の文が変わる
useUnsavedGuard(isImporting, { reason: "inProgress" });
// 保存待ちの Promise が終わるまで守る(Promise でない値は素通り)
const saving = useUnsavedTasks({ when: guardUnsaved });
saving.track(onCellChange(event));

// 移動は守り付きの router(next/navigation の useRouter と同じ名前・同じ形)
import { useRouter } from "@/lib/unsavedGuard";
const router = useRouter();
router.push("/admin/samples"); // 編集済みなら確認してから
```

| 入口 | 中身 |
|---|---|
| `UnsavedGuardProvider({ confirm })` | 守りを置く。`confirm(request) => boolean \| Promise<boolean>`(true = 移る)。`request.kind` = link / anchor / push / replace / back / forward / popstate、`request.reasons` = いま立っている元の理由 |
| `useUnsavedGuard(when, { reason })` | when が true の間守る。reason の既定 `unsaved` |
| `useUnsavedTasks({ when, reason })` | `track(value)` した Promise が 1 つでも終わっていない間守る。when = false の間は守らない |
| `useUnsavedSource(reason)` / `useUnsavedSourceFactory()` | 編集済みの元(`set(active)` を同期に呼べる。送信の直前に外す等)/ その作り方(結線が棚の口へ入れる) |
| `UnsavedReason` / `UNSAVED_REASONS` / `pickConfirmReason(reasons)` | 理由の閉じた一覧 / 確認に出す理由を 1 つ選ぶ(`inProgress` が勝つ) |
| `useRouter()` | push / replace / back / forward は編集済みの間に確認。refresh / prefetch はそのまま。Provider の外は素の Next の router |
| `useLinkNavigateJudge()` | 棚の Link の `onNavigate` に渡す判定(結線が棚の Navigation の口へ入れる) |

- 送信: AppForm は送信の直前に同期に外し(`onSubmit` の中の `router.push` を聞かない)、失敗(throw)なら戻す。成功の後は次の入力まで外したまま。`guardUnsaved={false}` で切る
- 「移る」を選んだ後は、住所が変わる(移動が終わる)か編集済みの元が無くなるまで聞かない

## 理由と確認の文

- 理由は閉じた一覧: `unsaved`(保存していない変更。既定)・`inProgress`(処理の途中。離れると中断される)。使い手ごとの自由な文は受けない
- 元がいくつ立っていても 1 回の移動に確認は 1 回(フォームの中のアップロードも特別な扱いをしない)。確認には立っている理由を全部渡し、結線は `pickConfirmReason` で 1 つ選ぶ(`inProgress` が勝つ)
- 文は `src/config/ui/unsaved-guard.config.ts` の `UNSAVED_GUARD_CONFIRM`(理由ごとに題・説明・ボタンの語。fork は値だけ替える)。再読み込み・タブを閉じるときはブラウザの確認で、この文は出ない

## 受け止める経路と手段(試作の計測で決めた、D11)

| 経路 | 手段 |
|---|---|
| 棚の Link | `next/link` の `onNavigate`(押した時に棚の Navigation の口へ判定を聞く = 描いた後に編集済みになっても効く)。止めて確認し、移るなら元の href へ素の router で(replace / scroll も保つ) |
| router.push / replace / back / forward | 守り付きの `useRouter`(lint で next/navigation の useRouter を止める: 上流 error・fork warn)。back の「移る」は今が番兵の履歴なら番兵を飛ばして 2 つ戻る |
| 同じオリジンの素の `<a>` | document の click の capture(棚の Link の `<a>` は `data-navigation-port` の印で除く)。別のタブ・download・修飾キー・同じページの `#` は通す |
| 戻る / 進む | popstate の番兵: 編集済みになった時に同じ住所の履歴を 1 つ積む(Next の `history.state` は残す)。留まるなら積み直し、移るなら番兵の先へもう 1 つ戻る |
| 再読み込み・タブを閉じる・別のオリジン | `beforeunload`(ブラウザの確認。文言は変えられない) |

限界: 編集済みの間は「進む」の履歴が番兵で消える(戻った先から進めない)。保存して留まったときは番兵が 1 つ残る(戻るで同じ住所に 1 回留まる)。

### 捨てた案(調査 research/unsaved-guard-proto、chromium 142・firefox 144)

| 案 | Link | router.push | 戻る/進む | 再読み込み・閉じる | 捨てた理由 |
|---|---|---|---|---|---|
| a Navigation API(`navigate` を取り消す) | ずれる(画面は移り住所が残る) | ずれる | ○(chromium) | ○ | Next が画面を描いた後の pushState を取り消すので画面と住所がずれる。firefox 144 に無い(147 から) |
| b nextjs-nav-guard(外のライブラリ) | ○ | ○ | ○ | ○ | Next の内部(`next/dist/shared/lib/app-router-context`)と history の書き換えに頼る。内部が変わると push / Link の守りが黙って消える |
| c onNavigate + capture + 番兵 + beforeunload | ○ | × | ○(進むは番兵で消える) | ○ | 採った。router.push の穴はこの lib の守り付きの router と lint で塞ぐ |
| fork の自作 d(oripa-do) | ○ | × | × | ○ | 戻る / 進む・push を受けない |
| fork の自作 e(boardgame-site) | ○ | × | 戻る ○(進むは番兵で消える) | ○ | push を受けない |

この lib(c + 守り付きの router)は 4 経路を全部受け止める: 受入のテスト `tests/e2e/unsavedGuard/unsavedGuard.spec.ts`(chromium・firefox・webkit)。

## テスト

- `pnpm test src/lib/` — 本体(`guard.ts`)を偽物の window / document で + 使い手の lib の判定(取り込み・アップロード・表・並べ替え)
- `pnpm e2e tests/e2e/unsavedGuard` — 実際のブラウザで 4 経路 × 留まる / 移る(dev server が要る: `tests/e2e/unsavedGuard/README.md`。e2eFixtures が閉なら skip)
