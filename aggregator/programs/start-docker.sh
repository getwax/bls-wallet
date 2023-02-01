#!/bin/bash

set -euo pipefail

if [ -z ${VERSION+x} ]; then
  >&2 echo "Missing VERSION. Needs to match the first 7 characters of the git sha used to build the docker image."
  >&2 echo "Usage: VERSION=abc1234 start-docker.sh"
  exit 1
fi

ENV_PATH="${ENV_PATH:=.env}"

# Normalize ENV_PATH to an absolute path
if [[ $(echo $ENV_PATH | head -c1) != "/" ]]; then
  ENV_PATH="$(cd $(dirname $ENV_PATH) && pwd)/$(basename $ENV_PATH)"
fi

echo "Using env" $ENV_PATH

PORT=$(cat $ENV_PATH | grep '^PORT=' | tail -n1 | sed 's/^PORT=//')
NETWORK_CONFIG_PATH=$(cat $ENV_PATH | grep '^NETWORK_CONFIG_PATH=' | tail -n1 | sed 's/^NETWORK_CONFIG_PATH=//')

# Normalize NETWORK_CONFIG_PATH to an absolute path
if [[ $(echo $NETWORK_CONFIG_PATH | head -c1) != "/" ]]; then
  NETWORK_CONFIG_PATH="$(cd $(dirname $ENV_PATH) && cd $(dirname $NETWORK_CONFIG_PATH) && pwd)/$(basename $NETWORK_CONFIG_PATH)"
fi

echo "Using network config" $NETWORK_CONFIG_PATH

NETWORK=$(basename $NETWORK_CONFIG_PATH .json)
CONTAINER_NAME="aggregator-$VERSION-$NETWORK"
IMAGE_NAME="aggregator:git-$VERSION"

echo "Creating $CONTAINER_NAME using $IMAGE_NAME"

docker run \
  --name "$CONTAINER_NAME" \
  -d \
  --net=host \
  --restart=unless-stopped \
  --mount type=bind,source="$ENV_PATH",target=/app/.env \
  --mount type=bind,source="$NETWORK_CONFIG_PATH",target=/app/networkConfig.json \
  "$IMAGE_NAME"
