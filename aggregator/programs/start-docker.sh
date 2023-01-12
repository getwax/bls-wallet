#!/bin/bash

set -euo pipefail


# Standard template for running the aggregator docker image.
#
# Requires the variables below which can be uncommented + updated or passed in
# like this:
#   VAR1=foo VAR2=bar ./start-docker.sh


# The first 7 bytes of the git version sha used to build the docker image.
# VERSION=1d35f4e

# Path to the .env file for the aggregator to use (variables in the current
# script won't generally be available inside the container).
# ENV_PATH=/home/you/bls-wallet/aggregator/.env.docker

# Path to the network config containing addresses etc. Overrides value from
# env file.
# NETWORK_CONFIG_PATH=/home/you/bls-wallet/contracts/networks/local.json

# The ethereum network targeted (used to name the container).
# NETWORK=local

# Port to use. Overrides value in env file.
# PORT=3000


docker run \
  --name aggregator-$VERSION-$NETWORK \
  -d \
  -p$PORT:$PORT \
  --env PORT_OVERRIDE=$PORT \
  --restart=unless-stopped \
  --mount type=bind,source="$ENV_PATH",target=/app/.env \
  --mount type=bind,source="$NETWORK_CONFIG_PATH",target=/app/networkConfig.json \
  aggregator:git-$VERSION
