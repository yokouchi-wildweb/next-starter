// src/app/(user)/demo/dummy-payment/_screen/DemoDummyPaymentScreen.tsx
// /demo/dummy-payment(デモ)の既定画面。

import type { ScreenProps } from "@/lib/screens/types";
import { DummyPaymentForm } from "@/features/core/purchaseRequest/components/DummyPaymentForm";

import { loadDemoDummyPaymentScreen } from "./loader";

export async function DemoDummyPaymentScreen(props: ScreenProps) {
  await loadDemoDummyPaymentScreen(props);

  return <DummyPaymentForm />;
}
