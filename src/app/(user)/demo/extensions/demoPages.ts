// 生成物・編集不可: pnpm extensions:generate が src/app/(user)/demo/extensionPoints.ts から生成する
// demoPages: src/app/(user)/demo/*/_demo.ts の export const demo(folder = フォルダ名、並びはフォルダ名の順)

import type { DemoPage } from "@/app/(user)/demo/_data/demoPages";

import { demo as async_picker_modal } from "@/app/(user)/demo/async-picker-modal/_demo";
import { demo as bank_transfer_vision } from "@/app/(user)/demo/bank-transfer-vision/_demo";
import { demo as block_appearance } from "@/app/(user)/demo/block-appearance/_demo";
import { demo as check_env } from "@/app/(user)/demo/check-env/_demo";
import { demo as dummy_payment } from "@/app/(user)/demo/dummy-payment/_demo";
import { demo as fade_slider } from "@/app/(user)/demo/fade-slider/_demo";
import { demo as field_layout } from "@/app/(user)/demo/field-layout/_demo";
import { demo as fingerprint } from "@/app/(user)/demo/fingerprint/_demo";
import { demo as form_components } from "@/app/(user)/demo/form-components/_demo";
import { demo as google_popup } from "@/app/(user)/demo/google-popup/_demo";
import { demo as google_redirect } from "@/app/(user)/demo/google-redirect/_demo";
import { demo as media_input } from "@/app/(user)/demo/media-input/_demo";
import { demo as overlay } from "@/app/(user)/demo/overlay/_demo";
import { demo as popover } from "@/app/(user)/demo/popover/_demo";
import { demo as scroll_slider } from "@/app/(user)/demo/scroll-slider/_demo";
import { demo as seamless_av } from "@/app/(user)/demo/seamless-av/_demo";
import { demo as seamless_video } from "@/app/(user)/demo/seamless-video/_demo";
import { demo as sortable_list } from "@/app/(user)/demo/sortable-list/_demo";
import { demo as status_badge } from "@/app/(user)/demo/status-badge/_demo";
import { demo as tables } from "@/app/(user)/demo/tables/_demo";

export const demoPages: DemoPage[] = [
  { ...async_picker_modal, folder: "async-picker-modal" },
  { ...bank_transfer_vision, folder: "bank-transfer-vision" },
  { ...block_appearance, folder: "block-appearance" },
  { ...check_env, folder: "check-env" },
  { ...dummy_payment, folder: "dummy-payment" },
  { ...fade_slider, folder: "fade-slider" },
  { ...field_layout, folder: "field-layout" },
  { ...fingerprint, folder: "fingerprint" },
  { ...form_components, folder: "form-components" },
  { ...google_popup, folder: "google-popup" },
  { ...google_redirect, folder: "google-redirect" },
  { ...media_input, folder: "media-input" },
  { ...overlay, folder: "overlay" },
  { ...popover, folder: "popover" },
  { ...scroll_slider, folder: "scroll-slider" },
  { ...seamless_av, folder: "seamless-av" },
  { ...seamless_video, folder: "seamless-video" },
  { ...sortable_list, folder: "sortable-list" },
  { ...status_badge, folder: "status-badge" },
  { ...tables, folder: "tables" },
];
