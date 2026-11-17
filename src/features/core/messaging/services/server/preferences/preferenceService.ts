// src/features/core/messaging/services/server/preferences/preferenceService.ts
//
// 利用者の好み(配信停止、D35・D45・D71)の読み書き。/api/me/messaging/preferences と、サーバーの呼び手(会員登録など)が呼ぶ。
// - 止め方は 6 つ: 1 マス(種類 × 経路)・種類まるごと(経路 '*')・グループまるごと(category 'group:<鍵>' × 経路か '*'、D123)・
//   種別まるごと(kind X、'*' '*')・経路まるごと(種類 '*')・全部('*' '*')。グループの行は読む時の種類の group で当たる(後から入った種類も止まる、groupRows.ts)
// - 表に出す種類 = 利用者が止められる種別(性質 userStoppable)の種類だけ。形は経路 > 種別の枠 > グループ > 種類(dto.ts)
// - マスの止まり方は送る側(stops.ts checkStops = store.findOptOuts)と同じ: 当たる行が 1 つでもあれば止まる(和、許可の行は無い)。
//   kind null の行(表の '*'。store が読み替える、'*' のままでも同じに読む)は今までどおり、kind のある行は種類の種別が同じ時だけ当たる。via はどの行で止まっているか
//   (広い行で止まっているマスは、そのマスを再開しても止まったまま。種別まるごとだけは下の書き分けで再開できる)
// - 宛先の有無: 経路の自前の引き方(resolveAddresses)か、無ければ端末の帳簿の有効な行(送る側の展開と同じ)
// - 変える: 行を足す(source = 呼び手の値、既定 "user")/ 消す(その行だけ)。知らない種類・有効でない経路・止められない種別は 400
// - 広い行(種別まるごと・種類まるごと・グループまるごと・経路まるごと)の下でマスを 1 つ再開する → 1 つの transaction で覆う行を消し、
//   ほかは止まったままにする行に書き分ける(D71、指令 37 の AMENDMENT 1)。全部の行は書き分けない
// - 種類とグループの受け口は初めて使う時に validateMessageCategories で確かめる(誤りは投げる = 生成と同じ検査を実行時にも)

import {
  kindTraits,
  MESSAGE_KINDS,
  validateMessageCategories,
  type ChannelAddress,
  type MessageCategory,
  type MessageCategoryGroup,
  type MessageChannel,
  type MessageKind,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { MESSAGE_ALL } from "../../../entities/schema";
import { activeChannel } from "../sendMessage/expand";
import { groupRowCategory } from "./groupRows";
import type {
  MessagePreferenceChannelDto,
  MessagePreferenceGroupDto,
  MessagePreferenceGroupStopDto,
  MessagePreferencesDto,
  MessagePreferenceVia,
  SetMessagePreferenceOptions,
} from "./dto";
import { MessagePreferenceSourceSchema, SetMessagePreferenceInputSchema } from "./schema";
import type { MessagePreferenceAdd, MessagePreferenceKey, MessagePreferenceRow, MessagePreferenceStore } from "./types";

/** 好みの画面で止めた行の source(setPreference の既定) */
export const PREFERENCE_USER_SOURCE = "user";

export type PreferenceServiceDeps = {
  store: MessagePreferenceStore;
  categories: Readonly<Record<string, MessageCategory>>;
  /** 見出しのグループの受け口(categoryGroups。省略 = 無し) */
  groups?: Readonly<Record<string, MessageCategoryGroup>>;
  channels: Readonly<Record<string, MessageChannel>>;
  /** 端末の帳簿の有効な宛先(resolveAddresses を持たない経路) */
  findLedgerEndpoints: (channel: string, userIds: readonly string[]) => Promise<ChannelAddress[]>;
  /** 案内先が開いているか(門で閉じた住所の connectHref は出さない) */
  isHrefOpen: (href: string) => boolean;
};

/**
 * 行の集まりからマスの止まり方を決める(送る側の findOptOuts + checkStops と同じ判定)。
 * kind = 種類の種別(kind のある行はこれと同じ時だけ当たる)。group = 種類が入っている見出しのグループの鍵(無ければ null)。
 * 順は cell > category > group > kind > channel > all
 */
export function preferenceVia(
  rows: readonly MessagePreferenceRow[],
  category: string,
  channel: string,
  kind: string | null = null,
  group: string | null = null,
): MessagePreferenceVia | null {
  const plain = (c: string, ch: string) => rows.some((row) => noKind(row) && row.category === c && row.channel === ch);
  if (plain(category, channel)) return "cell";
  if (plain(category, MESSAGE_ALL)) return "category";
  if (group !== null && (plain(groupRowCategory(group), channel) || plain(groupRowCategory(group), MESSAGE_ALL))) return "group";
  if (
    kind !== null &&
    rows.some(
      (row) =>
        row.kind === kind &&
        (row.category === category || row.category === MESSAGE_ALL) &&
        (row.channel === channel || row.channel === MESSAGE_ALL),
    )
  ) {
    return "kind";
  }
  if (plain(MESSAGE_ALL, channel)) return "channel";
  if (plain(MESSAGE_ALL, MESSAGE_ALL)) return "all";
  return null;
}

/** 種別まるごとではない行(null か表の '*') */
const noKind = (row: MessagePreferenceRow) => row.kind === null || row.kind === undefined || row.kind === MESSAGE_ALL;

const isKindRow = (row: MessagePreferenceRow, kind: string) =>
  row.kind === kind && row.category === MESSAGE_ALL && row.channel === MESSAGE_ALL;

export function createPreferenceService(deps: PreferenceServiceDeps) {
  const groups = deps.groups ?? {};
  let checked = false;
  /** 種類とグループの受け口の検査(初めの 1 回) */
  function assertCategories(): void {
    if (checked) return;
    const problems = validateMessageCategories(deps.categories, groups);
    if (problems.length > 0) {
      throw new Error(`連絡の種類の受け口に誤りがあります: ${problems.map((problem) => problem.message).join(" / ")}`);
    }
    checked = true;
  }

  const enabledChannels = () =>
    Object.keys(deps.channels).flatMap((key) => {
      const channel = activeChannel(deps.channels, key);
      return channel ? [channel] : [];
    });
  // 表に出す種類 = 利用者が止められる種別(性質 userStoppable: activity・promotion)の種類だけ
  const listedCategories = () => Object.values(deps.categories).filter((category) => kindTraits(category.kind)?.userStoppable);
  /** 種類のある利用者が止められる種別(MESSAGE_KINDS の順) */
  const listedKinds = (): MessageKind[] => {
    const present = new Set(listedCategories().map((category) => category.kind));
    return MESSAGE_KINDS.filter((kind) => present.has(kind));
  };

  /** 種類が入っている見出しのグループの鍵(受け口に無いグループは null) */
  const groupOf = (category: MessageCategory): string | null =>
    category.group !== undefined && groups[category.group] ? category.group : null;
  /** 利用者が止められる種類を持つ見出しのグループ(order・鍵の順)と、その種類の種別(D82: グループは同じ種別の種類だけ) */
  const listedGroups = (): { key: string; group: MessageCategoryGroup; kind: MessageKind }[] => {
    const kindOf = new Map<string, MessageKind>();
    for (const category of listedCategories()) {
      const key = groupOf(category);
      if (key !== null && !kindOf.has(key)) kindOf.set(key, category.kind);
    }
    return [...kindOf.keys()]
      .sort((a, b) => groups[a].order - groups[b].order || a.localeCompare(b))
      .map((key) => ({ key, group: groups[key], kind: kindOf.get(key)! }));
  };

  async function hasAddress(channel: MessageChannel, userId: string): Promise<boolean> {
    const found = channel.resolveAddresses
      ? await channel.resolveAddresses([userId])
      : await deps.findLedgerEndpoints(channel.key, [userId]);
    return found.some((entry) => entry.userId === userId && Boolean(entry.address));
  }

  /** 種別の枠の中のグループ(グループの無い種類が先、見出しのグループは order・鍵の順) */
  function groupsOf(categories: readonly MessageCategory[], rows: readonly MessagePreferenceRow[], channel: string): MessagePreferenceGroupDto[] {
    const buckets = new Map<string | null, MessageCategory[]>();
    for (const category of categories) {
      const key = groupOf(category);
      buckets.set(key, [...(buckets.get(key) ?? []), category]);
    }
    const keys = [...buckets.keys()].sort((a, b) => {
      if (a === null) return -1;
      if (b === null) return 1;
      return groups[a].order - groups[b].order || a.localeCompare(b);
    });
    return keys.map((key) => ({
      key,
      label: key === null ? null : groups[key].label,
      optedOut: key !== null && rows.some((row) => noKind(row) && row.category === groupRowCategory(key) && row.channel === channel),
      categories: (buckets.get(key) ?? []).map((category) => {
        const via = preferenceVia(rows, category.key, channel, category.kind, groupOf(category));
        return { key: category.key, label: category.label, description: category.description ?? null, optedOut: via !== null, via };
      }),
    }));
  }

  async function getPreferences(userId: string): Promise<MessagePreferencesDto> {
    assertCategories();
    const channels = enabledChannels();
    const rows = await deps.store.listOwn(userId);
    const kinds = listedKinds();
    const categories = listedCategories();
    const channelDtos: MessagePreferenceChannelDto[] = [];
    for (const channel of channels) {
      const href = channel.connectHref ?? null;
      // 列は開いている経路 ∩ 種類の経路(D86 の D59 の直し)
      const onChannel = categories.filter((category) => category.channels.includes(channel.key));
      channelDtos.push({
        key: channel.key,
        label: channel.label,
        hasAddress: await hasAddress(channel, userId),
        connectHref: href && deps.isHrefOpen(href) ? href : null,
        optedOut: rows.some((row) => noKind(row) && row.category === MESSAGE_ALL && row.channel === channel.key),
        kinds: kinds.flatMap((kind) => {
          const ofKind = onChannel.filter((category) => category.kind === kind);
          return ofKind.length > 0 ? [{ kind, groups: groupsOf(ofKind, rows, channel.key) }] : [];
        }),
      });
    }
    return {
      allOptedOut: rows.some((row) => noKind(row) && row.category === MESSAGE_ALL && row.channel === MESSAGE_ALL),
      // 種類まるごと(種類, '*')の状態は種類ごとに 1 つ(経路ごとに繰り返さない)
      categories: categories.map((category) => ({
        key: category.key,
        optedOut: rows.some((row) => noKind(row) && row.category === category.key && row.channel === MESSAGE_ALL),
      })),
      kinds: kinds.map((kind) => ({ kind, optedOut: rows.some((row) => isKindRow(row, kind)) })),
      // グループまるごと(グループ, '*')の状態はグループごとに 1 つ(経路ごとの状態は channels[].kinds[].groups[].optedOut)
      groups: listedGroups().map(
        ({ key, group, kind }): MessagePreferenceGroupStopDto => ({
          key,
          label: group.label,
          kind,
          optedOut: rows.some((row) => noKind(row) && row.category === groupRowCategory(key) && row.channel === MESSAGE_ALL),
        }),
      ),
      channels: channelDtos,
    };
  }

  /**
   * 1 マス・種類まるごと(channel '*')・経路まるごと(category '*')・全体・種別まるごと・グループまるごとを止める / 再開する。変えた後の表を返す。
   * 広い行の下の 1 マスの再開は splitForCell で書き分ける
   * options.source = 書いた入口(既定 user。HTTP の本文からは受けない)
   * @throws DomainError(400) 入力の誤り・知らない種類・知らないグループ・有効でない経路・利用者が止められない種別
   */
  async function setPreference(
    userId: string,
    input: unknown,
    options: SetMessagePreferenceOptions = {},
  ): Promise<MessagePreferencesDto> {
    assertCategories();
    const parsed = SetMessagePreferenceInputSchema.safeParse(input);
    const sourceParsed = MessagePreferenceSourceSchema.safeParse(options.source ?? PREFERENCE_USER_SOURCE);
    if (!parsed.success || !sourceParsed.success) {
      throw new DomainError("通知設定の入力が正しくありません", { status: 400 });
    }
    const source = sourceParsed.data;
    const value = parsed.data;

    if ("kind" in value) {
      if (!kindTraits(value.kind)?.userStoppable) {
        throw new DomainError("この種類の通知は受け取りを止められません", { status: 400 });
      }
      const row = { category: MESSAGE_ALL, channel: MESSAGE_ALL, kind: value.kind };
      await deps.store.write(userId, value.optedOut ? { add: [{ ...row, source }] } : { remove: [row] });
      return getPreferences(userId);
    }

    if ("group" in value) {
      // 利用者が止められる種類を持つ見出しのグループだけ(止められない種別の種類だけのグループは表に出ない)
      if (!listedGroups().some((item) => item.key === value.group)) {
        throw new DomainError("選んだ通知のグループが見つかりません", { status: 400 });
      }
      const channel = value.channel ?? MESSAGE_ALL;
      if (channel !== MESSAGE_ALL && !activeChannel(deps.channels, channel)) {
        throw new DomainError("選んだ通知方法が見つかりません", { status: 400 });
      }
      // 再開はその行だけを消す(広い行の再開と同じ。グループの中の種類の行は残る)
      const row = { category: groupRowCategory(value.group), channel };
      await deps.store.write(userId, value.optedOut ? { add: [{ ...row, source }] } : { remove: [row] });
      return getPreferences(userId);
    }

    const { category, channel, optedOut } = value;
    const target = category === MESSAGE_ALL ? null : listedCategories().find((item) => item.key === category);
    if (category !== MESSAGE_ALL && !target) {
      throw new DomainError("選んだ通知のカテゴリーが見つかりません", { status: 400 });
    }
    if (channel !== MESSAGE_ALL && !activeChannel(deps.channels, channel)) {
      throw new DomainError("選んだ通知方法が見つかりません", { status: 400 });
    }
    if (optedOut) {
      await deps.store.write(userId, { add: [{ category, channel, source }] });
      return getPreferences(userId);
    }
    // 広い行(カテゴリーまるごと・経路まるごと・全部)の再開はその行だけを消す
    if (!target || channel === MESSAGE_ALL) {
      await deps.store.write(userId, { remove: [{ category, channel }] });
      return getPreferences(userId);
    }
    await deps.store.write(userId, splitForCell(await deps.store.listOwn(userId), target, channel, source));
    return getPreferences(userId);
  }

  /**
   * 1 マス(target × channel)を再開する書き込み(1 つの transaction)。和の判定で許可の行は無いので、そのマスを覆う広い行を消し、
   * そのマスのほかは止まったままにする行を足す(D71 と同じ書き分け)。全部('*' '*')は書き分けない(via all で止まったまま)
   * - 種別まるごと → 同じ種別のほかの種類の種類まるごと + この種類のほかの経路のマス
   * - 種類まるごと(target, '*')→ この種類のほかの経路のマス
   * - グループまるごと(グループ, '*')→ 同じグループのほかの種類の種類まるごと + この種類のほかの経路のマス
   * - グループ × 経路(グループ, channel)→ 同じグループのほかの種類でこの経路を持つ物のマス
   *   (書き分けた後はグループの行が無いので、後からグループに入った種類は止まらない。種別まるごとの書き分けと同じ)
   * - 経路まるごと('*', channel)→ この経路を持つほかの種類のマス
   */
  function splitForCell(
    rows: readonly MessagePreferenceRow[],
    target: MessageCategory,
    channel: string,
    source: string,
  ): { remove: MessagePreferenceKey[]; add: MessagePreferenceAdd[] } {
    const remove: MessagePreferenceKey[] = [{ category: target.key, channel }];
    const adds = new Map<string, MessagePreferenceAdd>();
    const add = (category: string, ch: string) => {
      if (category === target.key && ch === channel) return;
      adds.set(`${category}|${ch}`, { category, channel: ch, source });
    };
    const has = (category: string, ch: string) =>
      rows.some((row) => noKind(row) && row.category === category && row.channel === ch);
    const otherChannelsOfTarget = () => {
      for (const ch of target.channels) add(target.key, ch);
    };
    if (rows.some((row) => isKindRow(row, target.kind))) {
      remove.push({ category: MESSAGE_ALL, channel: MESSAGE_ALL, kind: target.kind });
      for (const other of listedCategories()) {
        if (other.kind === target.kind && other.key !== target.key) add(other.key, MESSAGE_ALL);
      }
      otherChannelsOfTarget();
    }
    if (has(target.key, MESSAGE_ALL)) {
      remove.push({ category: target.key, channel: MESSAGE_ALL });
      otherChannelsOfTarget();
    }
    const group = groupOf(target);
    if (group !== null) {
      const groupRow = groupRowCategory(group);
      const others = listedCategories().filter((other) => other.key !== target.key && groupOf(other) === group);
      if (has(groupRow, MESSAGE_ALL)) {
        remove.push({ category: groupRow, channel: MESSAGE_ALL });
        for (const other of others) add(other.key, MESSAGE_ALL);
        otherChannelsOfTarget();
      }
      if (has(groupRow, channel)) {
        remove.push({ category: groupRow, channel });
        for (const other of others) if (other.channels.includes(channel)) add(other.key, channel);
      }
    }
    if (has(MESSAGE_ALL, channel)) {
      remove.push({ category: MESSAGE_ALL, channel });
      for (const other of listedCategories()) {
        if (other.key !== target.key && other.channels.includes(channel)) add(other.key, channel);
      }
    }
    return { remove, add: [...adds.values()] };
  }

  return { getPreferences, setPreference };
}

export type PreferenceService = ReturnType<typeof createPreferenceService>;
