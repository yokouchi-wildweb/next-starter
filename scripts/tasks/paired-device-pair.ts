// scripts/tasks/paired-device-pair.ts
// 登録端末のペアリングコードを CLI から発行する（管理画面を作る前の最初の 1 台・復旧用）。
// 新しい端末を登録して発行するか、既存の端末（--device）に発行する（再ペアリング）。
// 使い方: pnpm task paired-device-pair -- --kind <kind> --label <表示名> [--scope '<JSON>']
//        pnpm task paired-device-pair -- --device <端末 id>

import type { OneShotTask } from "./types";

export const task: OneShotTask = {
  name: "paired-device-pair",
  run: async () => {
    const { runAsSystem } = await import("@/lib/audit");
    const { createPairedDevice, issuePairingCode } = await import(
      "@/features/core/pairedDevice/services/server"
    );
    const args = process.argv.slice(3).filter((arg) => arg !== "--");
    const readFlag = (name: string): string | undefined => {
      const index = args.indexOf(`--${name}`);
      return index >= 0 ? args[index + 1] : undefined;
    };
    const usage =
      "使い方: pnpm task paired-device-pair -- --kind <kind> --label <表示名> [--scope '<JSON>'] | --device <端末 id>";
    return await runAsSystem(async () => {
      let deviceId = readFlag("device");
      if (!deviceId) {
        const kind = readFlag("kind");
        const label = readFlag("label");
        if (!kind || !label) throw new Error(usage);
        const scopeRaw = readFlag("scope");
        const scope = scopeRaw ? (JSON.parse(scopeRaw) as unknown) : undefined;
        const device = await createPairedDevice({ kind, label, scope }, "system");
        deviceId = device.id;
      }
      const issued = await issuePairingCode(deviceId, "system");
      return { deviceId, code: issued.code, expiresAt: issued.expiresAt.toISOString() };
    });
  },
};
