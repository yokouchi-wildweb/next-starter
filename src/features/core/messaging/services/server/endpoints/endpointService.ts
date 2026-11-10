// src/features/core/messaging/services/server/endpoints/endpointService.ts
//
// 端末の帳簿(message_endpoints: 利用者 × 経路 × 宛先)の本人の登録・削除・一覧と、退会の後片付け(D43・D45)。
// - 受け付ける経路: 経路の受け口に項目があり、enabled で、自前の宛先の引き方(resolveAddresses)を持たない経路
//   (= 帳簿を読む経路。上流の email・inApp・line は自前の帳簿なので受け付けない。push・SMS などは fork が足す)
// - 登録: 本人の (channel, address) があれば更新して有効に戻す。他人の (channel, address) は付け替えない(409)
// - 返すのは安全な DTO(宛先は末尾 6 文字、metadata は返さない)

import type { MessageChannel } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import type { MessageEndpoint } from "../../../entities/model";
import {
  RegisterMessageEndpointInputSchema,
  type MessageEndpointDto,
} from "./schema";
import type { MessageEndpointStore } from "./types";

export type EndpointServiceDeps = {
  store: MessageEndpointStore;
  channels: Readonly<Record<string, MessageChannel>>;
  now: () => Date;
};

const HINT_LENGTH = 6;

export function toEndpointDto(row: MessageEndpoint): MessageEndpointDto {
  return {
    id: row.id,
    channel: row.channel,
    kind: row.kind,
    addressHint: row.address.slice(-HINT_LENGTH),
    isActive: row.is_active,
    lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 帳簿を読む経路か(項目があり enabled で、自前の宛先の引き方を持たない) */
export function isLedgerChannel(channels: Readonly<Record<string, MessageChannel>>, key: string): boolean {
  const channel = channels[key];
  return Boolean(channel && channel.enabled !== false && !channel.resolveAddresses);
}

export function createEndpointService(deps: EndpointServiceDeps) {
  return {
    /**
     * 本人の宛先を登録する(同じ宛先の本人の行は更新して有効に戻す)。
     * @throws DomainError(400) 入力の誤り・帳簿を読まない経路 / DomainError(409) 他人が登録した宛先
     */
    async registerEndpoint(userId: string, input: unknown): Promise<MessageEndpointDto> {
      const parsed = RegisterMessageEndpointInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new DomainError("端末の登録の入力が正しくありません", { status: 400 });
      }
      const { channel, address, kind, metadata } = parsed.data;
      if (!isLedgerChannel(deps.channels, channel)) {
        throw new DomainError(`経路 ${channel} は端末の登録を受け付けません(帳簿を読む経路だけ)`, { status: 400 });
      }
      const now = deps.now();
      const existing = await deps.store.findByChannelAddress(channel, address);
      if (existing && existing.user_id !== userId) {
        // 他人の宛先を自分へ付け替えない(乗っ取りを防ぐ)
        throw new DomainError("この宛先は別の利用者が登録しています", { status: 409 });
      }
      const row = existing
        ? await deps.store.update(existing.id, {
            kind: kind ?? existing.kind,
            metadata: metadata ?? existing.metadata,
            is_active: true,
            updatedAt: now,
          })
        : await deps.store.insert({
            user_id: userId,
            channel,
            address,
            kind: kind ?? null,
            metadata: metadata ?? null,
            is_active: true,
          });
      return toEndpointDto(row);
    },

    /**
     * 本人の宛先を消す。
     * @throws DomainError(404) 本人の行が無い(他人の id も同じく 404)
     */
    async removeEndpoint(userId: string, id: string): Promise<void> {
      const deleted = await deps.store.deleteOwn(userId, id);
      if (!deleted) throw new DomainError("端末の登録が見つかりません", { status: 404 });
    },

    /** 本人の宛先の一覧 */
    async listEndpoints(userId: string): Promise<MessageEndpointDto[]> {
      return (await deps.store.listOwn(userId)).map(toEndpointDto);
    },
  };
}

export type EndpointService = ReturnType<typeof createEndpointService>;
