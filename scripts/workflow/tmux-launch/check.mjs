// scripts/workflow/tmux-launch/check.mjs — SessionStart hook(.claude/settings.json)
//
// ターミナルの claude(CLAUDE_CODE_ENTRYPOINT=cli)を tmux の外で起動し、このマシンに tmux で開く設定が無い・古いときだけ、
// エージェントへの 1 行を出す。それ以外(設定済み・tmux の中・VS Code 拡張・デスクトップアプリ)は何も出さない。
// 失敗しても起動を止めない(常に exit 0)。説明: scripts/workflow/tmux-launch/README.md

try {
  if (process.env.CLAUDE_CODE_ENTRYPOINT === "cli" && !process.env.TMUX && !process.env.NO_TMUX_LAUNCH) {
    const { inspect } = await import("./lib.mjs");
    const state = inspect();
    if (!state.ok) {
      const what = state.stale ? "古い" : "まだ無い";
      console.log(
        `[tmux-launch] このマシンでは claude を tmux で開く設定が${what}(pnpm setup:tmux-launch --check で詳細)。` +
          "ユーザーに 1 回だけ伝え、承認をもらってから pnpm setup:tmux-launch を実行する" +
          (state.tmux ? "。" : "(tmux が無い: 先に ! sudo apt install tmux か ! brew install tmux を案内する)。") +
          "済んだら新しいターミナルで claude を打ち直してもらう(続きは claude --continue)。説明: scripts/workflow/tmux-launch/README.md",
      );
    }
  }
} catch {
  // 案内が出せないだけ。起動は止めない
}
