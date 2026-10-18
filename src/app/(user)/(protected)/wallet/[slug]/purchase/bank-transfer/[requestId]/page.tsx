// src/app/(user)/(protected)/wallet/[slug]/purchase/bank-transfer/[requestId]/page.tsx
// 1 行スイッチ(下流所有)。画面を差し替えるときは import 先を ./_components/<Name>Screen に向ける

export { WalletPurchaseBankTransferScreen as default } from "./_screen/WalletPurchaseBankTransferScreen";
