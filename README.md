# BLS Aggregator

Aggregation service for bls-signed transaction data.

Accepts posts of signed transactions and, upon instruction, can aggregate
signatures and submit a transaction batch to the configured Verification
Gateway.

# Installation

Latest deno v1.9.0 produces an error in deno.land/x/postgres, use preceding
version for now.
`curl -fsSL https://deno.land/x/install/install.sh > install.sh`
`sh install.sh v1.8.3`

Uses Deno, Oak, Postgresql.

## Running

Can be run locally or hosted.

`deno run --allow-net --allow-env --allow-read  --unstable src/app/app.ts`

# Development

VSCode extension 3.2.0 is required since the latest (3.3.0) is tied to  deno 1.9.0