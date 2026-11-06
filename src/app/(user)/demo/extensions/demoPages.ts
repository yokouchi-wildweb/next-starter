// 生成物・編集不可: pnpm generate extensions が src/app/(user)/demo/extensionPoints.ts から生成する
// demoPages: src/app/(user)/demo/*/_demo.ts の export const demo(folder = フォルダ名、並びはフォルダ名の順)

import type { DemoPage } from "@/app/(user)/demo/_data/demoPages";

import { demo as demoPages_async_picker_modal } from "@/app/(user)/demo/async-picker-modal/_demo";
import { demo as demoPages_bank_transfer_vision } from "@/app/(user)/demo/bank-transfer-vision/_demo";
import { demo as demoPages_block_appearance } from "@/app/(user)/demo/block-appearance/_demo";
import { demo as demoPages_dummy_payment } from "@/app/(user)/demo/dummy-payment/_demo";
import { demo as demoPages_fade_slider } from "@/app/(user)/demo/fade-slider/_demo";
import { demo as demoPages_field_layout } from "@/app/(user)/demo/field-layout/_demo";
import { demo as demoPages_fingerprint } from "@/app/(user)/demo/fingerprint/_demo";
import { demo as demoPages_form_components } from "@/app/(user)/demo/form-components/_demo";
import { demo as demoPages_google_popup } from "@/app/(user)/demo/google-popup/_demo";
import { demo as demoPages_google_redirect } from "@/app/(user)/demo/google-redirect/_demo";
import { demo as demoPages_media_input } from "@/app/(user)/demo/media-input/_demo";
import { demo as demoPages_overlay } from "@/app/(user)/demo/overlay/_demo";
import { demo as demoPages_popover } from "@/app/(user)/demo/popover/_demo";
import { demo as demoPages_scroll_slider } from "@/app/(user)/demo/scroll-slider/_demo";
import { demo as demoPages_seamless_av } from "@/app/(user)/demo/seamless-av/_demo";
import { demo as demoPages_seamless_video } from "@/app/(user)/demo/seamless-video/_demo";
import { demo as demoPages_sortable_list } from "@/app/(user)/demo/sortable-list/_demo";
import { demo as demoPages_status_badge } from "@/app/(user)/demo/status-badge/_demo";
import { demo as demoPages_tables } from "@/app/(user)/demo/tables/_demo";

export const demoPages: DemoPage[] = [
  { ...demoPages_async_picker_modal, folder: "async-picker-modal" },
  { ...demoPages_bank_transfer_vision, folder: "bank-transfer-vision" },
  { ...demoPages_block_appearance, folder: "block-appearance" },
  { ...demoPages_dummy_payment, folder: "dummy-payment" },
  { ...demoPages_fade_slider, folder: "fade-slider" },
  { ...demoPages_field_layout, folder: "field-layout" },
  { ...demoPages_fingerprint, folder: "fingerprint" },
  { ...demoPages_form_components, folder: "form-components" },
  { ...demoPages_google_popup, folder: "google-popup" },
  { ...demoPages_google_redirect, folder: "google-redirect" },
  { ...demoPages_media_input, folder: "media-input" },
  { ...demoPages_overlay, folder: "overlay" },
  { ...demoPages_popover, folder: "popover" },
  { ...demoPages_scroll_slider, folder: "scroll-slider" },
  { ...demoPages_seamless_av, folder: "seamless-av" },
  { ...demoPages_seamless_video, folder: "seamless-video" },
  { ...demoPages_sortable_list, folder: "sortable-list" },
  { ...demoPages_status_badge, folder: "status-badge" },
  { ...demoPages_tables, folder: "tables" },
];
