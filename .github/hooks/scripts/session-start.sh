#!/usr/bin/env bash
# Injects project context into every new agent session.
# VS Code SessionStart hook — output injected into agent context.
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
NODE_VER=$(node --version 2>/dev/null || echo "unknown")
STACK="Vite+React+TypeScript frontend (Muse/Music/Musician), Node/Express+MongoDB backend, pnpm monorepo"
MSG="Branch: ${BRANCH} | Node: ${NODE_VER} | Stack: ${STACK}"
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$MSG"
