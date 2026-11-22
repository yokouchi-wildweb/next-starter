// src/domains/core/messaging/services/server/lists.ts
//
// messaging の点(差す側の <ドメイン>/plugs/messaging<点>/)の生成の一覧を、読み手が鍵で引く表にする唯一の口(段 3 注文 28)。
// - 部品(送信チャンネル・付け足し・レイアウトと描き方・送り元・購読)は閉じたドメインの項目を外す(gate.plugs、D22・D26)
// - カテゴリーとそのグループは、保存した配信設定の行の鍵の定義なので絞らない(設定の欄と同じ、注文 26 の答え)。
//   人に見せる一覧(配信設定の画面・管理画面の選択肢)は shownCategories で閉じたドメインの物を隠す(設定の節と同じ)
// 門番の開閉はプロセスの間変わらないので、表は読み込みの時に 1 回作る

import "server-only";

import { gate } from "@/featureGate";
import type {
  MessageCategory,
  MessageCategoryGroup,
  MessageChannel,
  MessageEnricher,
  MessageSource,
  MessageSubscriber,
} from "@/lib/messaging";

import { messagingCategories } from "../../extensions/messagingCategories";
import { messagingCategoryGroups } from "../../extensions/messagingCategoryGroups";
import { messagingChannels } from "../../extensions/messagingChannels";
import { messagingEnrichers } from "../../extensions/messagingEnrichers";
import { messagingSources } from "../../extensions/messagingSources";
import { messagingSubscribers } from "../../extensions/messagingSubscribers";

import { keyedPlugs } from "./layoutLists";

// レイアウトの表は送信チャンネルの項目(email)も読むので別のファイル(送信チャンネルの一覧との値の輪を作らない)
export { keyedPlugs, layoutEmails, layouts } from "./layoutLists";

/** カテゴリー(鍵 → 定義)。保存した配信設定の鍵の定義なので絞らない */
export const categories: Readonly<Record<string, MessageCategory>> = keyedPlugs(messagingCategories, (c) => c.key);
/** カテゴリーのグループ(鍵 → 定義)。絞らない */
export const categoryGroups: Readonly<Record<string, MessageCategoryGroup>> = keyedPlugs(messagingCategoryGroups, (g) => g.key);
/** 人に見せるカテゴリー(閉じたドメインの物を隠す): 配信設定の画面・管理画面の選択肢 */
export const shownCategories: Readonly<Record<string, MessageCategory>> = keyedPlugs(gate.plugs(messagingCategories), (c) => c.key);

/** 送信チャンネル(閉じたドメインの物は外す) */
export const channels: Readonly<Record<string, MessageChannel>> = keyedPlugs(gate.plugs(messagingChannels), (c) => c.key);
/** 文面の付け足し */
export const enrichers: Readonly<Record<string, MessageEnricher>> = keyedPlugs(gate.plugs(messagingEnrichers), (e) => e.key);
/** 送り元 */
export const sources: Readonly<Record<string, MessageSource>> = keyedPlugs(gate.plugs(messagingSources), (s) => s.key);
/** 送った後の購読 */
export const subscribers: Readonly<Record<string, MessageSubscriber>> = keyedPlugs(gate.plugs(messagingSubscribers), (s) => s.key);
