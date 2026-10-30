# kinds(登録端末の種類の受け口)

`<名前>.<fork の名前>.ts` に `export const kind = definePairedDeviceKind({ kind: "<kind の値>", ... })` を置き、`pnpm extensions:generate`。上流の項目は 0。項目が無い kind の端末は作成も認証もできない(fail-closed)。
書き方: `src/features/core/pairedDevice/README.md` / 仕組み: `scripts/extensions/README.md`
