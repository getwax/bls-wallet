#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

set -meuo pipefail

function cleanup {
  jobs -p | xargs kill
}

trap cleanup EXIT

yarn hardhat node &

sleep 5

yarn hardhat run scripts/deploy_all.ts --network gethDev

fg
