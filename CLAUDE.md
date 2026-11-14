@AGENTS.md

## Claude Code notes

- Skills live in `.agents/skills/` (shared with Codex); `npm install` links them into `.claude/skills/`.
  The kids can type `/idea`, `/explain` and `/bug`.
- A hook checks every file you edit for syntax errors and tells you right away. Fix those first.
- The status line shows what this session has cost so far. Keep it low: small steps, few big file reads.
