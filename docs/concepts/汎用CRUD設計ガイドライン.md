# 汎用CRUD設計ガイドライン

このドキュメントは、Next.js + TypeScript プロジェクトで用意している汎用 CRUD 仕組みの使い方をまとめたものです。新しく入ったメンバーでも、プロジェクトのどこに何があるか、どのように拡張するかを迷わず理解できることを目指しています。

---

## 1. ガイドのゴール

- 共通 CRUD の構造をひと目で把握できること
- 既存の共通処理をそのまま再利用できるケースと、個別対応が必要なケースを判断できること
- ドメイン（＝管理したいデータのまとまり）を追加するときに、必要なファイルと設定を把握できること

---

## 2. 全体像

```
[React Hooks]
    ↓ （useDomainList など）
[クライアントサービス]
    ↓ （createApiClient が HTTP を発行）
[Next.js API ルート /api/[domain]]
    ↓ （serviceRegistry からドメインサービスを取得）
[サーバーサービス]
    ↓ （createCrudService が DB / Firestore を操作）
[データストア（Drizzle or Firestore）]
```

- UI からデータ操作が呼ばれると、React Hook → クライアントサービス → API ルート → サーバーサービス → データベース という順番で処理されます。
- ドメインごとのビジネスロジックは「サーバーサービス」が受け持ちます。単純な CRUD であれば共通処理だけで完結し、追加のコードは不要です。

---

## 3. 主要ディレクトリ

```
src/
  lib/
    crud/                 ← 共通 CRUD の基盤モジュール
      drizzle/            ← Drizzle（PostgreSQL）向けの汎用サービス
      firestore/          ← Firestore 向けの汎用サービス
      apiClientFactory.ts ← Axios ベースの API クライアント生成
      hooks/              ← React Hooks の薄いラッパー
      types.ts            ← 共通で使う型定義
      events.ts           ← CRUD 成功/失敗イベントの通知
  app/api/[domain]/...    ← 共通化された API ルート
  
  features/
    _template             ← ドメインの機能一式を自動生成するためのテンプレートファイル
    
    <domain>/    
      domain.json         ← ドメイン定義（スクリプトが生成・更新）
      entities/           ← サーバー用スキーマと `z.infer` 型（UI専用のスキーマは含めない）
      services/
        server/           ← サーバーサービス（Drizzle or Firestore ベース）
        client/           ← クライアントサービス（HTTP クライアント）
      hooks/              ← use<Domain> 系のフック
registry/
  serviceRegistry.ts      ← API ルートで利用するサービスの登録
```

---

## 4. 共通 CRUD 基盤（src/lib/crud）

### 4.1 Drizzle 用サービス
- `createCrudService` は Drizzle のテーブルを受け取り 
`create / list / get / update / remove / search / query / bulkDelete / upsert` をまとめて提供します。
- ID の採番方法（UUID・DB 自動採番など）、既定の並び順、検索対象カラムなどはオプションで指定できます。
- `search` では `searchQuery` と `searchFields` を組み合わせたあいまい検索、`where` 句での詳細な条件、`orderBy` やページングの指定が可能です。
- `query` を使うと、ドメイン固有の JOIN や複雑な集計を行いつつ、共通のページング処理だけを流用できます。
- `update` や `upsert` では、`null` を渡したフィールドは空値で上書きし、`undefined` を渡したフィールドは既存値を保持します。

### 4.2 Firestore 用サービス
- Firestore 向けにも同じインターフェースの `createCrudService` を用意しています。
- ドキュメント ID の採番方法（UUID・Firestore の自動 ID・任意 ID）を選べます。
- 検索は単純な一致検索＋並び替えに限定されます。複雑なフィルターが必要な場合は Firestore 特有の制約を踏まえて個別実装を検討してください。

### 4.3 共通ユーティリティ
- `apiClientFactory.ts`: Axios を使った `createApiClient` を提供し、HTTP リクエスト時に CRUD 成功/失敗イベントを発火します。
- `events.ts`: `registerCrudEventHandler` で CRUD 成功/失敗をまとめて監視できます。
- `hooks/`: `useDomainList`, `useDomain`, `useCreateDomain` など、クライアントサービスをそのまま渡すだけで使える汎用フックを揃えています。

---

## 5. API ルート

### 5.1 ルート構成
- `src/app/api/[domain]/route.ts` などの動的ルートが、サービス登録 (`serviceRegistry`) に基づいて処理を振り分けます。
- 追加のファイルを作らなくても、ドメインサービスを登録するだけで以下の標準エンドポイントが利用できます。

| HTTP | パス                          | サービスで呼ばれるメソッド | 説明                   | 
| ---- | ----------------------------- | --------------------------- |----------------------|
| GET  | `/api/<domain>`               | `list()`                    | 全件取得                 |
| POST | `/api/<domain>`               | `create(data)`              | レコードを作成              |
| GET  | `/api/<domain>/<id>`          | `get(id)`                   | 主キーで単体取得             |
| PUT  | `/api/<domain>/<id>`          | `update(id, data)`          | 更新（`null` は空値で上書きし、`undefined` は変更なし） |
| DELETE | `/api/<domain>/<id>`        | `remove(id)`                | 主キー削除              |
| GET  | `/api/<domain>/search`        | `search(params)`            | ページング・並び順・部分一致を備えた検索 |
| POST | `/api/<domain>/bulk/delete`   | `bulkDelete(ids)`           | ID 配列による一括削除              |
| PUT  | `/api/<domain>/upsert`        | `upsert(data)`              | 存在すれば更新、なければ作成 |

- `create` / `update` / `upsert` は JSON `{ "data": ... }` 形式でリクエストします。`bulkDelete` は `{ "ids": [...] }` を受け取ります。

### 5.2 サービス登録
- `src/registry/serviceRegistry.ts` にドメイン名とサーバーサービスを登録すると、API ルートから呼び出せるようになります。
- スクリプトで自動更新される領域があるため、手動で編集する場合はコメントに注意してください。

---

## 6. ドメインモジュールの作成手順

### 6.1 ドメイン定義（domain.json）
- 各ドメイン直下の `domain.json` に、テーブル名、ID の型、関連、フォーム項目などの情報をまとめています。
- スクリプトがこのファイルをもとにエンティティやサービスの雛形を生成・更新します。手動編集する際は整合性が取れているか確認してください。

### 6.2 エンティティ層
- `entities/schema.ts`: サーバー処理で利用する汎用スキーマを定義します。`XxxBaseSchema`／`XxxCreateSchema`／`XxxUpdateSchema` を基本形とし、フォーム専用スキーマを追加することは禁止です。
- `entities/form.ts`: `schema.ts` を `z.infer` した `XxxCreate`／`XxxUpdate` 型のみをエクスポートします。新規の Zod スキーマ定義や合成処理は行いません。
- `entities/drizzle.ts`: Drizzle のテーブル定義を記述します。
- `entities/index.ts` や `entities/model.ts` に、API を経由してやり取りする型・ドメインモデルを定義します。

### 6.3 サーバーサービス
1. **ベースサービスを選ぶ**
   - SQL（Neon/PostgreSQL）の場合は `services/server/base.ts` もしくは `services/server/drizzleBase.ts` で `createCrudService`（Drizzle 版）を呼び出します。
   - Firestore の場合は `services/server/firestoreBase.ts` で Firestore 版を呼び出します。
   - 生成済みのドメインではこれらのファイルが用意されているので、ID の採番方法や検索対象カラム、デフォルトの並び順などをここで調整します。
2. **サービス公開ファイル**
   - `services/server/<domain>Service.ts` でベースサービスを展開し、必要に応じて追加メソッドを合成します。
3. **カスタム処理が必要な場合**
   - `services/server/wrappers/` 配下に個別関数を作成し、`<domain>Service.ts` でベースサービスと差し替えます。
   - 例: JOIN を伴う検索や、関連テーブルの更新、外部ストレージの連携などをラップします。
   - `base.query()` や `base.create()` など共通メソッドを呼びつつ前後に処理を追加すると、既存コードとの一貫性を保てます。

### 6.4 クライアントサービス
- `services/client/<domain>Client.ts` で `createApiClient` を呼び出し、`ApiClient` 型としてエクスポートします。
- 作成・更新時に利用する型は `entities/form.ts` で公開される `z.infer` 型をそのまま渡します。
- 生成したクライアントは下記のメソッドを備えており、REST API を直接意識せずに CRUD 操作を呼び出せます。
  - `getAll()` / `getById(id)` … 一覧と単体取得。
  - `create(data)` / `update(id, data)` / `delete(id)` … 作成・更新・削除。
  - `search(params)` … ページングや `searchQuery`、`where` 句、`orderBy` を組み合わせた柔軟な検索。ドメインサービスが提供する複雑な検索条件をそのまま利用できます。
  - `bulkDelete(ids)` … ID 配列で一括削除。
  - `upsert(data, options)` … 衝突検知フィールドを切り替えながらの作成＋更新。
- 具体的な利用例と React Hooks との組み合わせは「[自動生成されるドメインのフック使用方法](../how-to/implementation/汎用CRUDのフック使用方法.md)」を参照してください。

### 6.5 React Hooks
- `hooks/` ディレクトリに `use<Domain>List`, `use<Domain>`, `useCreate<Domain>` などを配置し、`lib/crud/hooks` の汎用フックにクライアントサービスを渡すだけで利用できます。
- フックは 1 ファイル 1 機能を維持し、複数のフックを 1 ファイルにまとめない方針です。

### 6.6 レジストリ登録
- ドメインサービスを `serviceRegistry` に登録すると API から呼び出せます。登録漏れがあると 404 が返るので注意してください。

---

## 7. 汎用 CRUD をそのまま使えるケース

以下に当てはまる場合は、ベースサービスをそのまま公開するだけで十分です。

- 単一テーブルへの単純な作成・更新・削除・一覧取得ができればよい
- ID は UUID か自動採番のどちらかで問題ない
- 一覧画面の並び順や検索条件が単純（単一テーブルのカラムのみ）
- 関連テーブルの更新や外部サービス連携が不要
- Firestore なら単純なフィールド一致検索だけで足りる

---

## 8. 個別実装が必要になる主なパターン

下記のような場合は、`wrappers/` ディレクトリなどで個別処理を追加します。

- **複数テーブルを結合したい**: `base.query()` に独自の SELECT を渡してページングだけ共通化します。
- **関連テーブルも同時に更新したい**: 作成・更新処理をラップし、関連テーブルへの INSERT/DELETE を明示的に書きます。
- **外部ストレージや別サービスと連携したい**: 削除時にファイルを削除するなど、ベースサービスの後に追加処理を挟みます。
- **Firestore で高度な検索が必要**: Firestore の制約で対応できない場合は Cloud Functions など別手段を検討するか、Drizzle への移行を検討します。

---

## 9. クライアント側での使い方

- API エラーをまとめて扱いたい場合は、`setApiErrorHandler` で共通のハンドラを登録します（引数には `HttpError` が渡され、`status` や `responseData` を参照できます）。
- UI でのメッセージ表示は `err(error, fallback)` を利用すると、API レスポンス由来の文言とフォールバックメッセージを簡潔に切り替えられます。
- CRUD 完了時にトースト表示やログを取りたい場合は、`registerCrudEventHandler` でフックできます。
- SWR のキャッシュキーはシンプルな文字列を推奨します。ページングや検索条件がある場合は `[key, params]` などの形でユニークにしてください。

---

## 10. Firestore 利用時の注意点

- 並び替えとフィルターの組み合わせには Firestore の制約があるため、`search` メソッドでは単純な一致検索＋ 1 フィールドでの orderBy のみサポートしています。
- ページングはクエリ結果をクライアント側で分割する方式です。大量データを扱う場合は、カーソルを使った実装に切り替えるなどの改善を検討してください。

---

## 11. まとめ

- 共通 CRUD は「ベースサービス」「API クライアント」「React Hooks」がセットになっており、ドメインを追加しても同じ形で扱えます。
- 単純なドメインであれば、ベースサービスとレジストリ登録だけで CRUD API が完成します。
- 複雑な要件がある場合は `wrappers/` でベースサービスを拡張し、共通処理とカスタム処理を明確に分けると保守しやすくなります。
- 迷ったときは既存ドメインの実装を確認しながら、共通部分と個別部分を整理してください。
