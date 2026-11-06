// scripts/workflow/ownership/check.mjs — pnpm workflow ownership check [--parent=<remote> --branch=<branch> --json --verbose]
// fork の所有の検査(本体は src/lib/forkOwnership/cli.mjs、引数はそのまま)。終了コード: 0 = 合格 / 1 = 違反 / 2 = 未検証
import "../../../src/lib/forkOwnership/cli.mjs";
