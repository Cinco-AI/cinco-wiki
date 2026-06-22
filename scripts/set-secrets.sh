#!/usr/bin/env bash
# Pousse les secrets backend dans SSM Parameter Store pour un stage donné.
# Remplace `sst secret set`. Lit les valeurs depuis un fichier .env (défaut: ./.env).
#
# Usage:
#   ./scripts/set-secrets.sh <stage> [env-file]
#   ./scripts/set-secrets.sh dev
#   ./scripts/set-secrets.sh production .env.production
#
# Variables attendues dans le fichier .env :
#   MONGODB_URI   (requis)  -> SecureString
#   JWT_SECRET    (requis)  -> SecureString
#   MONGODB_DB    (optionnel, défaut "cinco-wiki")
#   CORS_ORIGINS  (optionnel, défaut "*")
set -euo pipefail

STAGE="${1:?Usage: set-secrets.sh <stage> [env-file]}"
ENV_FILE="${2:-.env}"
REGION="${AWS_REGION:-eu-west-3}"
PREFIX="/cinco-wiki/${STAGE}"

[ -f "$ENV_FILE" ] || { echo "Fichier introuvable : $ENV_FILE" >&2; exit 1; }

# Charge le .env sans exécuter de code arbitraire (lignes KEY=value uniquement).
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

put() { # name value type
  local name="$1" value="$2" type="$3"
  [ -n "$value" ] || { echo "  skip $name (vide)"; return; }
  aws ssm put-parameter --region "$REGION" \
    --name "${PREFIX}/${name}" --type "$type" --value "$value" --overwrite >/dev/null
  echo "  set ${PREFIX}/${name} (${type})"
}

echo "SSM <- $ENV_FILE (stage=$STAGE, region=$REGION)"
put MONGODB_URI  "${MONGODB_URI:-}"            SecureString
put JWT_SECRET   "${JWT_SECRET:-}"             SecureString
put MONGODB_DB   "${MONGODB_DB:-cinco-wiki}"   String
put CORS_ORIGINS "${CORS_ORIGINS:-*}"          String
echo "OK"
