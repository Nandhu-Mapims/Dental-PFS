#!/bin/sh
set -e

UPLOADS="/app/uploads"
BUNDLED="/app/uploads-bundled"

mkdir -p "$UPLOADS/feedback-voice" "$UPLOADS/feedback-voice/ai_voice"

# Seed the persistent volume from files baked into the image (repo uploads), file by file.
# Never overwrites, so recordings an admin uploaded survive every restart. Not `cp -rn`:
# BusyBox treats an existing directory as "already there" and silently copies nothing.
if [ -d "$BUNDLED" ]; then
  cd "$BUNDLED"
  find . -type f | while IFS= read -r file; do
    target="$UPLOADS/${file#./}"
    if [ ! -e "$target" ]; then
      mkdir -p "$(dirname "$target")"
      cp "$file" "$target"
    fi
  done
  cd /app
fi

exec node src/index.js
