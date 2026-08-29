#!/usr/bin/env bash
# PostToolUse hook — auto-formats TypeScript/SCSS files after agent edits.
# Runs Prettier on the edited file if it's a .ts, .tsx, .scss, or .css file.
# Returns additionalContext if formatting ran, or silent allow if skipped.

INPUT=$(cat)

# Extract file path from tool input (VS Code uses camelCase: filePath or files array)
FILE_PATH=$(printf '%s' "$INPUT" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
  const input = d.tool_input || {};
  // editFiles passes { files: ['path'] }, replace_string_in_file passes { filePath: 'path' }
  const fp = input.filePath || (Array.isArray(input.files) && input.files[0]) || '';
  process.stdout.write(fp);
" 2>/dev/null || true)

# Only format supported file types
if [[ "$FILE_PATH" =~ \.(ts|tsx|scss|css|js|jsx|json)$ ]]; then
  # Run prettier if available; graceful no-op if not installed
  if command -v npx &>/dev/null; then
    RESULT=$(npx --yes prettier --write "$FILE_PATH" 2>&1)
    EXIT=$?
    if [[ $EXIT -eq 0 ]]; then
      MSG="Prettier formatted: ${FILE_PATH}"
    else
      MSG="Prettier skipped (not configured or error): ${FILE_PATH}"
    fi
  else
    MSG="Prettier skipped (npx not available)"
  fi
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}' "$MSG"
else
  # Not a formattable file type — silent pass
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":""}}'
fi
