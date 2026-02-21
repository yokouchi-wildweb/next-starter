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
| 電話番号 | `buyer_phone_number` | ✅ 実装済み |
| 住所 | `buyer_address` | ✅ 実装済み |

### 型定義

`src/features/core/purchaseRequest/types/payment.ts` にプロバイダ非依存な型として定義:

```typescript
type BuyerAddress = {
  firstName?: string;
  lastName?: string;
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;            // 市区町村
  administrativeArea?: string;  // 都道府県
  postalCode?: string;
  country?: string;             // ISO 3166-1 alpha-2
};

type CreatePaymentSessionParams = {
  // ... 既存フィールド
  buyerEmail?: string;
  buyerPhoneNumber?: string;
  buyerAddress?: BuyerAddress;
  providerOptions?: Record<string, unknown>;
};
```

### Square APIへのマッピング

`squareProvider.ts` の `createSession()` 内で `BuyerAddress` → Square の `pre_populated_data.buyer_address` に自動変換:

- `firstName` → `first_name`
- `lastName` → `last_name`
- `addressLine1` → `address_line_1`
- `administrativeArea` → `administrative_district_level_1`

### 値の設定方法

下流プロジェクトでは `sessionEnricher` を使ってDBから住所情報を取得し設定する:

```typescript
setPaymentSessionEnricher(async ({ userId, baseParams }) => {
  const address = await addressService.getByUserId(userId);
  return {
    ...baseParams,
    buyerAddress: address ? {
      firstName: address.firstName,
      lastName: address.lastName,
      postalCode: address.postalCode,
      administrativeArea: address.prefecture,
      locality: address.city,
      addressLine1: address.line1,
      addressLine2: address.line2,
      country: "JP",
    } : undefined,
  };
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
