#!/usr/bin/env bash
# Restores a backup made by .github/workflows/backup.yml into a (new) Supabase project.
# Usage: BACKUP_PASSPHRASE=... TARGET_DB_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
#        scripts/restore.sh backup-YYYY-MM-DD.tar.gpg
# TARGET_DB_URL is the NEW project's Session pooler connection string. Run `npm ci` first.
set -euo pipefail

backup="${1:?usage: scripts/restore.sh <backup.tar.gpg>}"
: "${BACKUP_PASSPHRASE:?}" "${TARGET_DB_URL:?}" "${SUPABASE_URL:?}" "${SUPABASE_SERVICE_ROLE_KEY:?}"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "Decrypting..."
gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" -d "$backup" | tar -x -C "$work"

echo "Restoring logins (auth)..."
pg_restore --data-only --schema=auth --no-owner --no-privileges --disable-triggers \
  -d "$TARGET_DB_URL" "$work/database.dump" || echo "auth restore reported errors, check the output above"

echo "Restoring tables (public)..."
pg_restore --clean --if-exists --schema=public --no-owner --no-privileges \
  -d "$TARGET_DB_URL" "$work/database.dump" || echo "public restore reported errors, check the output above"

echo "Restoring files..."
node "$(dirname "$0")/restore-files.mjs" "$work/files"

echo "Done. Point the website's Supabase URL and keys at the new project."
