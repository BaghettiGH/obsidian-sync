#!/usr/bin/env bash
set -euo pipefail

FN_NAME="${1:?Usage: ./deploy.sh <function-name>}"
FN_DIR="functions/${FN_NAME}"

if [ ! -d "$FN_DIR" ]; then
  echo "No function directory found at $FN_DIR"
  exit 1
fi

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${PROJECT_ID:?Set PROJECT_ID env var first}"
: "${REGION:?Set REGION env var first}"
: "${BUCKET_NAME:?Set BUCKET_NAME env var first}"
: "${DEVICE_TOKEN:?Set DEVICE_TOKEN env var first}"
: "${SA_EMAIL:?Set SA_EMAIL env var first}"

echo "Deploying $FN_NAME..."

gcloud functions deploy "$FN_NAME" \
  --gen2 \
  --runtime=nodejs20 \
  --region="$REGION" \
  --source="$FN_DIR" \
  --entry-point="$FN_NAME" \
  --trigger-http \
  --allow-unauthenticated \
  --service-account="$SA_EMAIL" \
  --set-env-vars="BUCKET_NAME=${BUCKET_NAME},DEVICE_TOKEN=${DEVICE_TOKEN}" \
  --project="$PROJECT_ID"

echo "Done. Function URL:"
gcloud functions describe "$FN_NAME" --region="$REGION" --project="$PROJECT_ID" \
  --format="value(serviceConfig.uri)"