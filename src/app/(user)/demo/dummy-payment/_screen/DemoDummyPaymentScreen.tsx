// src/app/(user)/demo/dummy-payment/_screen/DemoDummyPaymentScreen.tsx
// /demo/dummy-payment(デモ)の既定画面。

import { DummyPaymentForm } from "@/domains/core/purchaseRequest/components/DummyPaymentForm";
import { createScreen } from "@/wiring/screen";

import { loadDemoDummyPaymentScreen } from "./loader";

export const { Screen: DemoDummyPaymentScreen, generateMetadata } = createScreen({
  load: loadDemoDummyPaymentScreen,
  render: () => <DummyPaymentForm />,
});
