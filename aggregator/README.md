# BLS Aggregator

Aggregation service for bls-signed transaction data.

Accepts transaction bundles (including bundles that contain a single
transaction) and submits aggregations of these bundles to the configured
Verification Gateway.

## Installation

Install [Deno](deno.land)

### Configuration

```sh
cp .env.example .env
```

Edit values as needed, e.g. private key and contract addresses.

You can also configure multiple environments by appending `.<name>`, for example
you might have:

```
.env.local
.env.optimistic-kovan
```

If you don't have a `.env`, you will need to append `--env <name>` to all
commands.

#### Environment Variables

| Name                         | Example Value                                                      | Description                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RPC_URL                      | https://localhost:8545                                             | The RPC endpoint for an EVM node that the BLS Wallet contracts are deployed on                                                                                       |
| USE_TEST_NET                 | false                                                              | Whether to set all transaction's `gasPrice` to 0. Workaround for some networks                                                                                       |
| ORIGIN                       | http://localhost:3000                                              | The origin for the aggregator client. Used only in manual tests                                                                                                      |
| PORT                         | 3000                                                               | The port to bind the aggregator to                                                                                                                                   |
| NETWORK_CONFIG_PATH          | ../contracts/networks/local.json                                   | Path to the network config file, which contains information on deployed BLS Wallet contracts                                                                         |
| PRIVATE_KEY_AGG              | 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 | Private key for the EOA account used to submit bundles on chain                                                                                                      |
| PRIVATE_KEY_ADMIN            | 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d | Private key for the admin EOA account. Used only in tests                                                                                                            |
| TEST_BLS_WALLETS_SECRET      | test-bls-wallets-secret                                            | Secret used to seed BLS Wallet private keys during tests                                                                                                             |
| PG_HOST                      | 127.0.0.1                                                          | Postgres database host                                                                                                                                               |
| PG_PORT                      | 5432                                                               | Postgres database port                                                                                                                                               |
| PG_USER                      | bls                                                                | Postgres database user                                                                                                                                               |
| PG_PASSWORD                  | generate-a-strong-password                                         | Postgres database password                                                                                                                                           |
| PG_DB_NAME                   | bls_aggregator                                                     | Postgres database name                                                                                                                                               |
| BUNDLE_TABLE_NAME            | bundles                                                            | Postgres table name for bundles                                                                                                                                      |
| BUNDLE_QUERY_LIMIT           | 100                                                                | Maximum number of bundles returned from Postgres                                                                                                                     |
| MAX_AGGREGATION_SIZE         | 12                                                                 | Maximum number of actions from bundles which will be aggregated together for submission on chain                                                                     |
| MAX_AGGREGATION_DELAY_MILLIS | 5000                                                               | Maximum amount of time in milliseconds aggregator will wait before submitting bundles on chain                                                                       |
| MAX_UNCONFIRMED_AGGREGATIONS | 3                                                                  | Maximum unconfirmed bundle aggregations that will be submitted on chain. Multiplied with `MAX_AGGREGATION_SIZE` to determine maximum of unconfirmed on chain actions |
| LOG_QUERIES                  | false                                                              | Whether to print Postgres queries in event log.`TEST_LOGGING` must be enabled                                                                                        |
| TEST_LOGGING                 | false                                                              | Whether to print aggregator server events to stdout. Useful for debugging & logging.                                                                                 |
| FEE_TYPE                     | ether OR token:0xabcd...1234                                       | The fee type the aggregator will accept. Either `ether` for ETH/chains native currency or `token:0xabcd...1234` (token contract address) for an ERC20 token          |
| FEE_PER_GAS                  | 0                                                                  | Minimum amount per gas (gasPrice) the aggregator will accept in ETH/chain native currency/ERC20 tokens                                                               |
| FEE_PER_BYTE                 | 0                                                                  | Minimum amount per calldata byte the aggregator will accept in ETH/chain native currency/ERC20 tokens (rollup L1 cost)                                               |

### PostgreSQL

#### With docker-compose

```sh
cd .. # root of repo
docker-compose up -d postgres
```

#### Local Install

Install, e.g.:

```sh
sudo apt update
sudo apt install postgresql postgresql-contrib
```

Create a user called `bls`:

```
$ sudo -u postgres createuser --interactive
Enter name of role to add: bls
Shall the new role be a superuser? (y/n) n
Shall the new role be allowed to create databases? (y/n) n
Shall the new role be allowed to create more new roles? (y/n) n
```

Set the user's password:

```
$ sudo -u postgres psql                                                
psql (12.6 (Ubuntu 12.6-0ubuntu0.20.04.1))
Type "help" for help.

postgres=# ALTER USER bls WITH PASSWORD 'generate-a-strong-password';
```

Create a table called `bls_aggregator`:

```sh
sudo -u postgres createdb bls_aggregator
```

On Ubuntu (and probably elsewhere), postgres is configured to offer SSL
connections but with an invalid certificate. However, the deno driver for
postgres doesn't support this.

There are two options here:

1. Set up SSL with a valid certificate
   ([guide](https://www.postgresql.org/docs/current/ssl-tcp.html)).
2. Turn off SSL in postgres (only for development or if you can ensure the
   connection isn't vulnerable to attack).
   1. View the config location with
      `sudo -u postgres psql -c 'SHOW config_file'`.
   2. Turn off ssl in that config.
      ```diff
      -ssl = on
      +ssl = off
      ```
   3. Restart postgres `sudo systemctl restart postgresql`.

## Running

Can be run locally or hosted.

```sh
./programs/aggregator.ts
# Or if you have a named environment (see configuration section):
# ./programs/aggregator.ts --env <name>
```

## Testing

- launch optimism
- deploy contract script
- run tests

NB each test must use unique address(es). (+ init code)

## Development

### Environment

This project is written in TypeScript targeting Deno. To get your tools to
interpret the code correctly you'll need deno-specific tooling - if you're using
VS Code then you should get the
[Deno Extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno).

### Programs

The main entry point is located at `./programs/aggregator.ts`, but there are
other useful utilities in there that call into `src`, such as
`./programs/showTables.ts`. Everything in `src` is library-style code - it
provides functions, classes, constants etc, but doesn't do anything on its own
if you run it directly.

### Testing

Tests are defined in `test`. Running them directly is a bit verbose because of
the deno flags you need:

```sh
deno test --allow-net --allow-env --allow-read --unstable
```

Instead, `./programs/premerge.ts` may be more useful for you. It'll make sure
all TypeScript compiles correctly before running anything (in deno it's easy to
have broken TypeScript lying around because it only compiles the sources that
are actually imported whenever you run something). There's also a bunch of other
checking going on. As the name suggests, it's a good idea to make sure this
script completes successfully before merging into main.

### Troubleshooting

#### TS "Duplicate identifier" error

If you see TypeScript errors like below when attempting to run a script/command
from Deno such as `./programs/aggregator.ts`:

```sh
TS2300 [ERROR]: Duplicate identifier 'TypedArray'.
    type TypedArray =
         ~~~~~~~~~~
    at https://cdn.esm.sh/v59/node.ns.d.ts:508:10

    'TypedArray' was also declared here.
        type TypedArray =
             ~~~~~~~~~~
        at https://cdn.esm.sh/v62/node.ns.d.ts:508:10
```

You need to reload modules (`-r`):

```sh
deno run -r --allow-net --allow-env --allow-read --unstable ./programs/aggregator.ts
```

#### Transaction reverted: function call to a non-contract account

- Is `./contracts/contracts/lib/hubble-contracts/contracts/libs/BLS.sol`'s
  `COST_ESTIMATOR_ADDRESS` set to the right precompile cost estimator's contract
  address?
- Are the BLS Wallet contracts deployed on the correct network?
- Is `NETWORK_CONFIG_PATH` in `.env` set to the right config?

#### Deno version

Make sure your Deno version is
[up to date.](https://deno.land/manual/getting_started/installation#updating)

### Notable Components

- **src/chain**: Should contain all of the contract interactions, exposing more
  suitable abstractions to the rest of the code. There's still some contract
  interaction in `EthereumService` and in tests though.
- **`BlsWallet`**: Models a BLS smart contract wallet (see
  [BLSWallet.sol](https://github.com/jzaki/bls-wallet-contracts/blob/main/contracts/BLSWallet.sol)).
- **`app.ts`**: Runs the app (the aggregator), requiring only a definition of
  what to do with the events (invoked with `console.log` by
  `programs/aggregator.ts`).
- **`EthereumService`**: Responsible for submitting aggregations once they have
  been formed. This was where all the contract interaction was before
  `src/chain`. Might need some rethinking.
- **`BundleService`**: Keeps track of all stored transactions, as well as
  accepting (or rejecting) them and submitting aggregated bundles to
  `EthereumService`.
- **`BundleTable`**: Abstraction layer over postgres bundle tables, exposing
  typed functions instead of queries. Handles conversions to and from the field
  types supported by postgres so that other code can has a uniform js-friendly
  interface
  ([`TransactionData`](https://github.com/jzaki/bls-wallet-signer/blob/673e2ae/src/types.ts#L12)).
- **`Client`**: Provides an abstraction over the external HTTP interface so that
  programs talking to the aggregator can do so via regular js functions with
  types instead of dealing with raw HTTP. (This should maybe find its way into a
  separate library - at the moment bls-wallet-extension uses this via ad hoc
  copy+paste.)

## System Diagram

![System Diagram](./diagram.svg)

## Hosting Guide

1. Configure your server to allow TCP on ports 80 and 443
2. Follow the [Installation](#Installation) instructions
3. Install docker and nginx:
   `sudo apt update && sudo apt install docker.io nginx`

4. Run `./programs/build.ts`

- If you're using a named environment, add `--env <name>`
- If `docker` requires `sudo`, add `--sudo-docker`

5. Configure log rotation in docker by setting `/etc/docker/daemon.json` to

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
```

and restart docker `sudo systemctl restart docker`

6. Load the docker image: `sudo docker load <docker-image.tar.gz`
7. Run the aggregator:

```sh
sudo docker run \
  --name aggregator \
  -d \
  --net=host \
  --restart=unless-stopped \
  aggregator:latest
```

8. Create `/etc/nginx/sites-available/aggregator`

```nginx
server {
  server_name your-domain.org;

  root /home/aggregator/static-content;
  index index.html;

  location / {
    try_files $uri $uri/ @aggregator;
  }

  location @aggregator {
    proxy_pass http://localhost:3000;
  }
}
```

This allows you to add some static content at `/home/aggregator/static-content`.
Adding static content is optional; requests that don't match static content will
be passed to the aggregator.

9. Create a symlink in sites-enabled

```sh
ln -s /etc/nginx/sites-available/aggregator /etc/nginx/sites-enabled/aggregator
```

Reload nginx for config to take effect: `sudo nginx -s reload`

10. Set up https for your domain by following the instructions at
    https://certbot.eff.org/lets-encrypt/ubuntufocal-nginx.
