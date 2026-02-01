#!/usr/bin/env bash
set -euo pipefail

# Read hook payload from stdin
PAYLOAD=$(cat)

# Extract file path from the tool input
FILE_PATH=$(echo "$PAYLOAD" | jq -r '.tool_input.file_path // empty')

# Only process .ts and .tsx files
if [[ -z "$FILE_PATH" ]] || [[ ! "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
    exit 0
fi

# Check if file exists
if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

# Run oxlint on the specific file
OXLINT_OUTPUT=$(npx oxlint "$FILE_PATH" 2>&1) || true

# Check if there are any errors
if echo "$OXLINT_OUTPUT" | grep -q "error"; then
    # Format the output for Claude
    FORMATTED_OUTPUT=$(echo "$OXLINT_OUTPUT" | grep -E "(error|warning|×)" | head -20)

    # Output JSON with decision:block so Claude sees it
    jq -n \
        --arg file "$FILE_PATH" \
        --arg errors "$FORMATTED_OUTPUT" \
        --arg full_output "$OXLINT_OUTPUT" \
        '{
            decision: "block",
            reason: "[OXLINT] 检测到代码问题，请修复以下错误：\n\n文件: \($file)\n\n\($errors)\n\n请运行 `npx oxlint \($file)` 查看完整错误信息并修复。"
        }'
fi

exit 0
