#!/bin/bash

# Generate repository tree for README
# Usage: ./scripts/tree.sh

# Exclude patterns
EXCLUDE="node_modules|dist|build|.git|.cache|coverage"

echo "Nerva/"

if command -v tree &> /dev/null; then
  # Use tree command if available
  tree -I "$EXCLUDE" --dirsfirst -L 3
else
  # Fallback to find
  find . -type d \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/.git/*" \
    -not -path "*/.cache/*" \
    -not -path "*/coverage/*" \
    | sed 's|^./||' \
    | sort \
    | awk '{
      depth = gsub(/\//, "/", $0)
      for (i = 0; i < depth; i++) printf "  "
      split($0, parts, "/")
      print parts[length(parts)] "/"
    }'
fi

