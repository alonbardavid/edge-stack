#!/usr/bin/env bash
# Prints a whole Neon API list, every page of it, as one {"<key>": [...]} object.
# $1 = the list URL, $2 = the response's array key. Needs NEON_API_KEY.
set -euo pipefail

URL=$1
KEY=$2
LIMIT=100
CURSOR=""
while :; do
  PAGE=$(curl -fsS -G -H "Authorization: Bearer $NEON_API_KEY" -H "Accept: application/json" \
    "$URL" --data-urlencode "limit=$LIMIT" ${CURSOR:+--data-urlencode "cursor=$CURSOR"})
  printf '%s' "$PAGE" | jq -c --arg key "$KEY" '.[$key][]'
  COUNT=$(printf '%s' "$PAGE" | jq --arg key "$KEY" '.[$key] | length')
  CURSOR=$(printf '%s' "$PAGE" | jq -r '.pagination.next // .pagination.cursor // empty')
  if [ "$COUNT" -lt "$LIMIT" ] || [ -z "$CURSOR" ]; then
    break
  fi
done | jq -s --arg key "$KEY" '{($key): .}'
