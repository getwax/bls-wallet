#!/bin/bash

RPC_URL="${RPC_URL:=localhost:8545}"

max_tries=100
counter=0

function check_rpc() {
  curl -s -X POST \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":0}' \
    -H "Content-Type: application/json" \
    "$RPC_URL" \
    > /dev/null
}

while ! check_rpc; do
  sleep 0.1
  counter=$((counter + 1))
  if (( counter >= max_tries )); then
    echo "Error: Reached max_tries waiting for $RPC_URL to be available" >&2
    exit 1
  fi
done
