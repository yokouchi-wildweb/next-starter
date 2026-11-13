// src/features/core/messaging/services/server/preferences/preferenceService.ts
//
// 利用者の好み(種類 × 経路の配信停止、D35・D45)の読み書き。/api/me/messaging/preferences が呼ぶ。
// - 表: 種類の受け口(marketing・activity。取引・required の連絡は種類を持たないので出ない)× 有効な経路の受け口
// - マスの止まり方は送る側(stops.ts checkStops = store.findOptOuts)と同じ: そのマス・種類の '*'・経路の '*'・全体の '*' '*' の
//   どれかの行があれば止まる。via はどの行で止まっているか(広い行で止まっているマスは、そのマスを再開しても止まったまま)
// - 宛先の有無: 経路の自前の引き方(resolveAddresses)か、無ければ端末の帳簿の有効な行(送る側の展開と同じ)
// - 変える: 1 マスか全体('*' '*')の行を足す(source "user")/ 消す(そのマスの行だけ)。知らない種類・有効でない経路は 400

import { kindTraits, type ChannelAddress, type MessageCategory, type MessageChannel } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { MESSAGE_ALL } from "../../../entities/schema";
import { activeChannel } from "../sendMessage/expand";
import type {
  MessagePreferenceCategoryDto,
  MessagePreferenceChannelDto,
  MessagePreferencesDto,
  MessagePreferenceVia,
} from "./dto";
import { SetMessagePreferenceInputSchema } from "./schema";
import type { MessagePreferenceRow, MessagePreferenceStore } from "./types";

/** 好みの画面で止めた行の source */
export const PREFERENCE_USER_SOURCE = "user";

export type PreferenceServiceDeps = {
  store: MessagePreferenceStore;
  categories: Readonly<Record<string, MessageCategory>>;
  channels: Readonly<Record<string, MessageChannel>>;
  /** 端末の帳簿の有効な宛先(resolveAddresses を持たない経路) */
  findLedgerEndpoints: (channel: string, userIds: readonly string[]) => Promise<ChannelAddress[]>;
  /** 案内先が開いているか(門で閉じた住所の connectHref は出さない) */
  isHrefOpen: (href: string) => boolean;
};

/** 行の集まりからマスの止まり方を決める(送る側の findOptOuts + checkStops と同じ判定) */
export function preferenceVia(
  rows: readonly MessagePreferenceRow[],
  category: string,
  channel: string,
): MessagePreferenceVia | null {
  const has = (c: string, ch: string) => rows.some((row) => row.category === c && row.channel === ch);
  if (has(category, channel)) return "cell";
  if (has(category, MESSAGE_ALL)) return "category";
  if (has(MESSAGE_ALL, channel)) return "channel";
  if (has(MESSAGE_ALL, MESSAGE_ALL)) return "all";
  return null;
}

export function createPreferenceService(deps: PreferenceServiceDeps) {
  const enabledChannels = () =>
    Object.keys(deps.channels).flatMap((key) => {
      const channel = activeChannel(deps.channels, key);
      return channel ? [channel] : [];
    });
  // 表に出す種類 = 利用者が止められる種別(性質 userStoppable: activity・marketing)の種類だけ
  const listedCategories = () => Object.values(deps.categories).filter((category) => kindTraits(category.kind)?.userStoppable);

  async function hasAddress(channel: MessageChannel, userId: string): Promise<boolean> {
    const found = channel.resolveAddresses
      ? await channel.resolveAddresses([userId])
      : await deps.findLedgerEndpoints(channel.key, [userId]);
    return found.some((entry) => entry.userId === userId && Boolean(entry.address));
  }

  async function getPreferences(userId: string): Promise<MessagePreferencesDto> {
    const channels = enabledChannels();
    const rows = await deps.store.listOwn(userId);
    const channelDtos: MessagePreferenceChannelDto[] = [];
    for (const channel of channels) {
      const href = channel.connectHref ?? null;
      channelDtos.push({
        key: channel.key,
        label: channel.label,
        hasAddress: await hasAddress(channel, userId),
        connectHref: href && deps.isHrefOpen(href) ? href : null,
      });
    }
    const categories: MessagePreferenceCategoryDto[] = listedCategories().map((category) => ({
      key: category.key,
      label: category.label,
      description: category.description ?? null,
      kind: category.kind,
      // 列は開いている経路 ∩ 種類の経路(D86 の D59 の直し)
      cells: channels.filter((channel) => category.channels.includes(channel.key)).map((channel) => {
        const via = preferenceVia(rows, category.key, channel.key);
        return { channel: channel.key, optedOut: via !== null, via };
      }),
    }));
    return {
      allOptedOut: rows.some((row) => row.category === MESSAGE_ALL && row.channel === MESSAGE_ALL),
      channels: channelDtos,
      categories,
    };
  }

  /**
   * 1 マスか全体を止める / 再開する。変えた後の表を返す。
   * @throws DomainError(400) 入力の誤り・知らない種類・有効でない経路
   */
  async function setPreference(userId: string, input: unknown): Promise<MessagePreferencesDto> {
    const parsed = SetMessagePreferenceInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new DomainError("好みの入力が正しくありません", { status: 400 });
    }
    const { category, channel, optedOut } = parsed.data;
    if (category !== MESSAGE_ALL) {
      if (!listedCategories().some((item) => item.key === category)) {
        throw new DomainError(`種類 ${category} はありません`, { status: 400 });
      }
      if (!activeChannel(deps.channels, channel)) {
        throw new DomainError(`経路 ${channel} はありません`, { status: 400 });
      }
    }
    if (optedOut) {
      await deps.store.add({ userId, category, channel, source: PREFERENCE_USER_SOURCE });
    } else {
      await deps.store.remove(userId, category, channel);
    }
    return getPreferences(userId);
  }

  return { getPreferences, setPreference };
}

export type PreferenceService = ReturnType<typeof createPreferenceService>;
