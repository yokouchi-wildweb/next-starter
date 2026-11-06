# claude-tmux.sh — `claude` を tmux の中で開くシェル関数(next-starter 系のリポの中だけ)
#
# 2 つの使われ方:
#   1. ~/.bashrc / ~/.zshrc から読み込まれ、シェル関数 `claude` を定義する(pnpm setup:tmux-launch が置く)
#   2. tmux のタブの中で `bash <このファイル> run <リポのルート> <claude の引数...>` として動き、claude を起動する
#      claude が終わったら、そのセッションに claude のタブが残っていなければ pnpm dev:tab stop をする
# 普通のターミナルのタブと同じ振る舞い: claude 1 つにつき tmux のセッション 1 つ(destroy-unattached)。
# ターミナルを閉じるとセッションごと終わり、中の claude も Dev タブのサーバーも止まる(裏に残らない)
# 正本: next-starter の scripts/tmux-launch/claude-tmux.sh(ここを直したら版を上げる)。説明: scripts/tmux-launch/README.md

NEXT_STARTER_CLAUDE_TMUX_VERSION=2

# ---- 2. タブの中で動くとき ------------------------------------------------------------
if [ "${1:-}" = "run" ] && [ -n "${2:-}" ]; then
  __ct_root="$2"
  shift 2
  tmux set-option -w -t "$TMUX_PANE" @claude-tmux 1 >/dev/null 2>&1
  command claude "$@"
  __ct_rc=$?
  tmux set-option -w -u -t "$TMUX_PANE" @claude-tmux >/dev/null 2>&1
  __ct_session="$(tmux display-message -p -t "$TMUX_PANE" '#{session_name}' 2>/dev/null)"
  __ct_others="$(tmux list-windows -t "$__ct_session" -F '#{@claude-tmux}' 2>/dev/null | grep -c '^1$')"
  if [ "${__ct_others:-0}" = 0 ] && [ -f "$__ct_root/.agent/dev-tab.json" ] &&
    grep -q "\"session\": \"$__ct_session\"" "$__ct_root/.agent/dev-tab.json" 2>/dev/null; then
    (cd "$__ct_root" && pnpm -s dev:tab stop)
  fi
  exit "$__ct_rc"
fi

# ---- 1. シェル関数 ------------------------------------------------------------------
if [ -n "${BASH_VERSION:-}" ]; then __ct_self="${BASH_SOURCE[0]}"; else eval '__ct_self="${(%):-%x}"'; fi
unalias claude 2>/dev/null

claude() {
  # そのまま起動する場合: tmux の中 / 一時的に外す / 端末でない / tmux が無い
  if [ -n "${TMUX:-}" ] || [ -n "${NO_TMUX_LAUNCH:-}" ] || ! command -v tmux >/dev/null 2>&1; then
    command claude "$@"; return
  fi
  if [ -z "${CLAUDE_TMUX_ASSUME_TTY:-}" ] && { [ ! -t 0 ] || [ ! -t 1 ]; }; then
    command claude "$@"; return
  fi
  # 非対話・すぐ終わる使い方(-p / --print / --help / --version / サブコマンド)
  local __ct_a
  for __ct_a in "$@"; do
    case "$__ct_a" in -p | --print | -h | --help | -v | --version) command claude "$@"; return ;; esac
  done
  case "${1:-}" in
    mcp | config | update | doctor | install | setup-token | plugin | migrate-installer | agents) command claude "$@"; return ;;
  esac
  # next-starter 系のリポか(目印 .claude/tmux-launch を上にたどって探す)
  local __ct_root="$PWD"
  while [ "$__ct_root" != "/" ] && [ ! -f "$__ct_root/.claude/tmux-launch" ]; do __ct_root="$(dirname "$__ct_root")"; done
  if [ ! -f "$__ct_root/.claude/tmux-launch" ]; then
    command claude "$@"; return
  fi
  local __ct_session __ct_cmd
  __ct_session="$(printf '%s' "$(basename "$__ct_root")" | tr -c 'A-Za-z0-9_-' '-')"
  __ct_cmd="bash $(printf '%q' "$__ct_self") run $(printf '%q' "$__ct_root")"
  if [ $# -gt 0 ]; then __ct_cmd="$__ct_cmd $(printf '%q ' "$@")"; fi
  # 毎回新しいセッション(同じリポで 2 つ目なら <名前>-2, -3 …)。名前の照合は一覧で厳密に行う(-t は前方一致もする)
  local __ct_name="$__ct_session" __ct_n=2 __ct_list
  __ct_list="$(tmux list-sessions -F '#{session_name}' 2>/dev/null)"
  while printf '%s\n' "$__ct_list" | grep -qx -- "$__ct_name"; do __ct_name="$__ct_session-$__ct_n"; __ct_n=$((__ct_n + 1)); done
  # destroy-unattached: ターミナルを閉じて誰もつないでいなくなったら、セッションと中のプロセスを終える
  tmux new-session -s "$__ct_name" -c "$PWD" "$__ct_cmd" \; set-option destroy-unattached on
}
