// src/features/gacha/machines/createCardMachine.ts

// 1枚のカードの状態マシン（出現〜消去まで詳細に管理）
import { createMachine, sendParent, assign } from "xstate";
import { log } from "@/utils/log";

export const createCardMachine = (cardId: string) =>
  createMachine({
    id: `card-${cardId}`,
    initial: "init",
    context: {
      flipped: false,
      staged: false,
      dismissed: false,
    },
    states: {
      init: {
        on: {
          COME_OUT: "appearing", // 親からの命令でアニメ開始
        },
      },
      appearing: {
        on: {
          APPEARED: {
            // アニメーション完了を検知して移行
            target: "appeared",
            actions: sendParent({ type: "CARD_APPEARED" }),
          },
        },
      },
      appeared: {
        on: {
          PREPARE: "preparing", // 親からの命令で準備開始
        },
      },
      preparing: {
        on: {
          READY: {
            // アニメーション完了を検知して移行
            target: "ready",
            actions: [sendParent({ type: "CARD_READY" })],
          },
        },
      },
      ready: {
        on: {
          FLIP: {
            target: "flipped",
            actions: [
              assign({ flipped: (_) => true }),
              sendParent({ type: "CARD_FLIPPED" })],
          },
        },
      },
      flipped: {
        after: {
          200: "staging",
        },
      },
      staging: {
        on: {
          STAGED: {
            target: "staged",
          },
        },
      },
      staged: {
        on: {
          DISMISS: "dismissing",
        },
      },
      dismissing: {
        on: {
          DISMISSED: "dismissed",
        },
      },
      dismissed: {
        entry: [
          () => log(3, 'cared dismissed'),
          sendParent({ type: "CARD_DISMISSED" }),
        ],
        after: {
          1000: "done",
        },
      },
      done: {
      },
    },
  });