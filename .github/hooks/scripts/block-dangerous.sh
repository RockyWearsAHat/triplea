#!/usr/bin/env bash
# PreToolUse hook — blocks catastrophic destructive commands.
# Reads tool JSON from stdin; denies if command matches danger patterns.
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write((d.tool_input&&(d.tool_input.command||d.tool_input.input))||'')" 2>/dev/null || true)
if printf '%s' "$CMD" | grep -qEi 'rm[[:space:]]+-rf[[:space:]]+/|rm[[:space:]]+-rf[[:space:]]+\.|DROP[[:space:]]+DATABASE|git[[:space:]]+push[[:space:]]+.*--force'; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Catastrophic destructive command blocked. Run manually if intentional."}}'
  exit 0
fi
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
