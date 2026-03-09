// src/features/chatRoom/hooks/firestore/useResolvedParticipants.ts
//
// 参加者プロフィールの解決 Hook。
// ルーム一覧の participants（userId 配列）から表示情報をバッチ取得する。
// resolver はダウンストリームが注入する。
// 手動実装。

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ChatRoom } from "@/features/chatRoom/entities";
import type { ParticipantProfile, ParticipantResolver } from "@/features/chatRoom/entities/message";

export type UseResolvedParticipantsReturn = {
  /** userId → ParticipantProfile のマップ */
  profileMap: Map<string, ParticipantProfile>;
  /** 初回読み込み中 */
  isLoading: boolean;
};

/**
 * ルーム一覧の参加者プロフィールをバッチ解決する。
 *
 * - 全ルームの participants から一意な UID を収集（currentUid を除外）
 * - resolver を1回だけ呼び出してバッチ取得
 * - rooms 変更時は未取得の UID のみ追加取得（差分解決）
 *
 * @example
 * ```tsx
 * const { rooms } = useChatRooms(uid);
 * const { profileMap } = useResolvedParticipants(rooms, uid, async (uids) => {
 *   const users = await fetchUsersByIds(uids);
 *   return new Map(users.map(u => [u.id, { name: u.name, avatarUrl: u.avatarUrl }]));
 * });
 *
 * // 表示
 * const otherUid = room.participants?.find(p => p !== uid);
 * const profile = profileMap.get(otherUid!);
 * ```
 */
export function useResolvedParticipants(
  rooms: ChatRoom[],
  currentUid: string | null,
  resolver: ParticipantResolver,
): UseResolvedParticipantsReturn {
  const [profileMap, setProfileMap] = useState<Map<string, ParticipantProfile>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // 取得済み UID を保持（再取得を防止）
  const resolvedUidsRef = useRef<Set<string>>(new Set());

  // 全ルームから一意な他者 UID を収集
  const unresolvedUids = useMemo(() => {
    const allUids = new Set<string>();
    for (const room of rooms) {
      if (!room.participants) continue;
      for (const uid of room.participants) {
        if (uid !== currentUid && !resolvedUidsRef.current.has(uid)) {
          allUids.add(uid);
        }
      }
    }
    return Array.from(allUids);
  }, [rooms, currentUid]);

  const stableResolver = useCallback(resolver, [resolver]);

  useEffect(() => {
    if (unresolvedUids.length === 0) return;

    let isActive = true;
    setIsLoading(true);

    stableResolver(unresolvedUids)
      .then((resolved) => {
        if (!isActive) return;

        // 取得済みセットを更新
        for (const uid of unresolvedUids) {
          resolvedUidsRef.current.add(uid);
        }

        // 既存マップとマージ
        setProfileMap((prev) => {
          const next = new Map(prev);
          for (const [uid, profile] of resolved) {
            next.set(uid, profile);
          }
          return next;
        });
      })
      .catch((err) => {
        if (!isActive) return;
        console.error("[useResolvedParticipants]", err);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [unresolvedUids, stableResolver]);

  return { profileMap, isLoading };
}
