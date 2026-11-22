# kinds(登録端末の種類の受け口)

## Overview

- 登録端末の種類(kind)を 1 種類 1 ファイルで置く受け口。上流の項目は 0
- 項目が無い kind の端末は作成も認証もできない(fail-closed)

## Usage

- `<名前>.ts` に `export const kind = definePairedDeviceKind({ kind: "<kind の値>", ... })` を置き、`pnpm generate extensions`

## Related

- 書き方: `../README.md` の Extension「端末の種類（kind）を登録する」
- 受け口の仕組み: `scripts/structure/extensions/README.md`
