# BLS Aggregator

Aggregation service for bls-signed transaction data.

Accepts posts of signed transactions and, upon instruction, can aggregate
signatures and submit a transaction batch to the configured Verification
Gateway.

# Installation

Install [Deno](deno.land) (or `deno upgrade`) v1.9.1.
Uses ethers, Oak, Postgresql... see src/app/deps.ts

## Running

Can be run locally or hosted.

`deno run --allow-net --allow-env --allow-read  --unstable src/app/app.ts`

# Development

VSCode + Deno extension

Until they are updated, some modules need manual fixes in local cache:

1. In `~/.cache/deno/deps/https/cdn.skypack.dev/`, replace occurances of type `NodeJS.Timer` with `number`, will be found in Provider class.

2. In `~/.cache/deno/deps`, remove the template type `<Deno.NetAddr>` from `Deno.Conn` since it is no longer generic. (needed until [https://github.com/denodrivers/postgres/issues/280])
