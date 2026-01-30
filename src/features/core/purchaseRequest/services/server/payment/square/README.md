# Square 決済プロバイダ

Square Checkout API（Payment Links）を使用したリダイレクト型決済の実装。

## ファイル構成

```
square/
├── README.md           # このファイル
├── squareProvider.ts   # メインのプロバイダ実装
└── errorMapping.ts     # エラーコードのマッピング
```

## 購入者情報の事前入力

Square決済ページで購入者情報を事前入力するには、`pre_populated_data` を使用します。

### 対応フィールド

| フィールド | Square API パラメータ | 説明 |
|-----------|----------------------|------|
| メールアドレス | `buyer_email` | ✅ 実装済み |
| 電話番号 | `buyer_phone_number` | 未実装 |
| 住所 | `buyer_address` | 未実装 |

### 実装箇所

#### 1. 型定義の追加

`src/features/core/purchaseRequest/types/payment.ts`:

```typescript
export type CreatePaymentSessionParams = {
  // ... 既存フィールド
  buyerEmail?: string;      // ✅ 実装済み
  buyerPhone?: string;      // 追加時はここに定義
  buyerAddress?: {          // 追加時はここに定義
    addressLine1?: string;
    addressLine2?: string;
    locality?: string;      // 市区町村
    administrativeDistrictLevel1?: string;  // 都道府県
    postalCode?: string;
    country?: string;       // 例: "JP"
  };
};
```

#### 2. Square プロバイダでの使用

`squareProvider.ts` の `createSession()` 内:

```typescript
const requestBody: SquareCreatePaymentLinkRequest = {
  // ... 既存設定

  // 購入者情報の事前入力
  ...(params.buyerEmail && {
    pre_populated_data: {
      buyer_email: params.buyerEmail,
      // 電話番号を追加する場合:
      // buyer_phone_number: params.buyerPhone,
      // 住所を追加する場合:
      // buyer_address: {
      //   address_line_1: params.buyerAddress?.addressLine1,
      //   locality: params.buyerAddress?.locality,
      //   administrative_district_level_1: params.buyerAddress?.administrativeDistrictLevel1,
      //   postal_code: params.buyerAddress?.postalCode,
      //   country: params.buyerAddress?.country || "JP",
      // },
    },
  }),
};
```

#### 3. 購入サービスでの値取得

`src/features/core/purchaseRequest/services/server/wrappers/purchaseService.ts`:

```typescript
// ユーザー情報を取得
const user = await userService.get(userId);
const buyerEmail = user?.email || undefined;
// const buyerPhone = user?.phone || undefined;  // 電話番号追加時

const session = await provider.createSession({
  // ... 既存パラメータ
  buyerEmail,
  // buyerPhone,  // 電話番号追加時
});
```

## 商品名の設定

決済ページに表示される商品名は `metadata.itemName` で指定:

```typescript
// purchaseService.ts
const session = await provider.createSession({
  metadata: itemName ? { itemName } : undefined,
});

// squareProvider.ts
quick_pay: {
  name: params.metadata?.itemName || "購入",  // デフォルト: "購入"
}
```

## 環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `SQUARE_ACCESS_TOKEN` | APIアクセストークン | `EAAAl0jQ...` |
| `SQUARE_LOCATION_ID` | ロケーションID | `L8TJFN3GM34G4` |
| `SQUARE_SIGNATURE_KEY` | Webhook署名検証キー | `sNrcAKRu...` |
| `SQUARE_NOTIFICATION_URL` | Webhook通知URL | `https://example.com/api/webhook/payment?provider=square` |
| `SQUARE_ENVIRONMENT` | 環境（sandbox/production） | `production` |

## 参考リンク

- [Square Payment Links API](https://developer.squareup.com/reference/square/checkout-api/create-payment-link)
- [Pre-populated Data](https://developer.squareup.com/reference/square/objects/PrePopulatedData)
