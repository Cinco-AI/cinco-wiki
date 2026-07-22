#!/usr/bin/env bash
# Pousse les secrets backend dans SSM Parameter Store pour un stage donné.
# Remplace `sst secret set`. Lit les valeurs depuis un fichier .env (défaut: ./.env).
#
# Usage:
#   ./scripts/set-secrets.sh [stage] [env-file]   (stage défaut: dev)
#   ./scripts/set-secrets.sh                       # stage dev, .env
#   ./scripts/set-secrets.sh production .env.production
#
# Via npm (les args passent après --) :
#   npm run secrets:set                # stage dev
#   npm run secrets:set -- production
#
# Région / profil AWS (ordre de priorité, plus fort en premier) :
#   1. variables shell    AWS_REGION=... AWS_PROFILE=... npm run secrets:set
#   2. valeurs dans .env  (AWS_REGION=... / AWS_PROFILE=... dans le fichier .env)
#   3. défaut région eu-west-3 ; profil = profil par défaut de l'AWS CLI
# IMPORTANT : les paramètres SSM sont par région — utiliser la MÊME région ici
# que pour `serverless deploy`, sinon `${ssm:...}` ne les trouvera pas.
#
# Variables attendues dans le fichier .env :
#   MONGODB_URI   (requis)  -> SecureString
#   JWT_SECRET    (requis)  -> SecureString
#   MONGODB_DB    (optionnel, défaut "cinco-wiki")
#   CORS_ORIGINS      (optionnel, défaut "*")
#   OPENAI_API_KEY    (optionnel) -> SecureString — résumé de liens + chat RAG
#   QDRANT_URL        (optionnel) -> String — URL HTTPS Qdrant (VPS)
#   QDRANT_API_KEY    (optionnel) -> SecureString
#   QDRANT_COLLECTION (optionnel) -> String — défaut cinco_wiki
#   NEO4J_URI         (optionnel) -> String — bolt:// | neo4j+s:// | https://
#   NEO4J_USER        (optionnel) -> String
#   NEO4J_PASSWORD    (optionnel) -> SecureString
#   OPENROUTER_API_KEY (optionnel) -> SecureString — si LLM_PROVIDER=openrouter
#   PUBLIC_APP_URL    (optionnel) -> String — base URL front (liens assistant)
#   LLM_PROVIDER      (optionnel) -> String — openai | openrouter
#   CHAT_MODEL / EMBEDDING_MODEL (optionnel)
set -euo pipefail

STAGE="${1:-dev}"
ENV_FILE="${2:-.env}"
PREFIX="/cinco-wiki/${STAGE}"

[ -f "$ENV_FILE" ] || { echo "Fichier introuvable : $ENV_FILE" >&2; exit 1; }

# Charge le .env (peut contenir AWS_REGION / AWS_PROFILE en plus des secrets).
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Résolu APRÈS le source : une var shell existante l'emporte sur le .env.
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-3}}"
PROFILE="${AWS_PROFILE:-}"

AWS_ARGS=(--region "$REGION")
[ -n "$PROFILE" ] && AWS_ARGS+=(--profile "$PROFILE")

put() { # name value type
  local name="$1" value="$2" type="$3"
  [ -n "$value" ] || { echo "  skip $name (vide)"; return; }
  aws ssm put-parameter "${AWS_ARGS[@]}" \
    --name "${PREFIX}/${name}" --type "$type" --value "$value" --overwrite >/dev/null
  echo "  set ${PREFIX}/${name} (${type})"
}

echo "SSM <- $ENV_FILE (stage=$STAGE, region=$REGION, profile=${PROFILE:-default})"
put MONGODB_URI  "${MONGODB_URI:-}"            SecureString
put JWT_SECRET   "${JWT_SECRET:-}"             SecureString
put MONGODB_DB   "${MONGODB_DB:-cinco-wiki}"   String
put CORS_ORIGINS "${CORS_ORIGINS:-*}"          String
put OPENAI_API_KEY "${OPENAI_API_KEY:-}"       SecureString
put QDRANT_URL     "${QDRANT_URL:-}"           String
put QDRANT_API_KEY "${QDRANT_API_KEY:-}"       SecureString
put QDRANT_COLLECTION "${QDRANT_COLLECTION:-cinco_wiki}" String
put NEO4J_URI      "${NEO4J_URI:-}"            String
put NEO4J_USER     "${NEO4J_USER:-neo4j}"      String
put NEO4J_PASSWORD "${NEO4J_PASSWORD:-}"       SecureString
put OPENROUTER_API_KEY "${OPENROUTER_API_KEY:-}" SecureString
put PUBLIC_APP_URL "${PUBLIC_APP_URL:-}"       String
put LLM_PROVIDER   "${LLM_PROVIDER:-openai}"   String
put CHAT_MODEL     "${CHAT_MODEL:-gpt-4o-mini}" String
put EMBEDDING_MODEL "${EMBEDDING_MODEL:-text-embedding-3-small}" String
echo "OK"
