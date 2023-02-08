#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

set -meuo pipefail

function cleanup {
  jobs -p | xargs kill
}

trap cleanup EXIT

docker pull ethereum/client-go:stable

CONTAINER=geth$RANDOM

docker run --name $CONTAINER --rm -p8545:8545 ethereum/client-go:stable \
  --http \
  --http.api eth,web3,personal,net \
  --http.addr=0.0.0.0 \
  --http.vhosts='*' \
  --dev \
  --dev.period=0 \
  &

"$SCRIPT_DIR/wait-for-rpc.sh"

docker exec $CONTAINER geth \
  --exec "$(cat "$SCRIPT_DIR/fundAccounts.js")" \
  attach 'http://localhost:8545'

yarn hardhat fundDeployer --network gethDev
yarn hardhat run scripts/deploy_all.ts --network gethDev

fg
