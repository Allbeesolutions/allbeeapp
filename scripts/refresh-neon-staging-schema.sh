#!/usr/bin/env bash
# Refresh only the isolated AllBee staging Neon Data API after SQL migrations.
set -euo pipefail
if [[ -z "${NEON_CLI_BIN:-}" || -z "${NEON_CONFIG_DIR:-}" ]]; then
  echo "Set NEON_CLI_BIN and NEON_CONFIG_DIR for the AllBee Neon profile" >&2
  exit 2
fi
project="icy-mud-74621536"
branch="br-long-cloud-azs3rmmb"
database="allbee"
expected_name="allbee-migration-lab-20261023"

[[ -x "$NEON_CLI_BIN" ]] || { echo "Neon CLI executable unavailable" >&2; exit 2; }
[[ -d "$NEON_CONFIG_DIR" ]] || { echo "AllBee CLI profile directory unavailable" >&2; exit 2; }
branches="$("$NEON_CLI_BIN" branches list --project-id "$project" --config-dir "$NEON_CONFIG_DIR" -o json)"
printf "%s" "$branches" | NEON_EXPECTED_BRANCH="$branch" NEON_EXPECTED_NAME="$expected_name" node -e '
let raw="";process.stdin.on("data",s=>raw+=s);process.stdin.on("end",()=>{
 const entries=JSON.parse(raw);
 if(!Array.isArray(entries)||!entries.some(x=>x.id===process.env.NEON_EXPECTED_BRANCH&&x.name===process.env.NEON_EXPECTED_NAME)){
  console.error("Refusing schema refresh outside isolated staging");process.exitCode=3;
 }
});
'
"$NEON_CLI_BIN" data-api refresh-schema \
  --project-id "$project" \
  --branch "$branch" \
  --database "$database" \
  --config-dir "$NEON_CONFIG_DIR"
echo "Staging Data API schema cache refreshed; production untouched"
