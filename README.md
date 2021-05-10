# BLS Aggregator

Aggregation service for bls-signed transaction data.

Accepts posts of signed transactions and, upon instruction, can aggregate
signatures and submit a transaction batch to the configured Verification
Gateway.

## Installation

Install [Deno](deno.land) (or `deno upgrade`) v1.9.1.
Uses ethers, Oak, Postgresql... see src/app/deps.ts

```sh
cp .env.example .env
# Modify parameters as needed
```

### PostgreSQL

Install, e.g.:

```sh
sudo apt install postgresql postgresql-contrib
```

Create a user called `bls`:

```
$ sudo -u postgres createuser --interactive
Enter name of role to add: bls
Shall the new role be a superuser? (y/n) n
Shall the new role be allowed to create databases? (y/n) y
Shall the new role be allowed to create more new roles? (y/n) n
```

Set the user's password:

```
$ sudo -u postgres psql                                                
psql (12.6 (Ubuntu 12.6-0ubuntu0.20.04.1))
Type "help" for help.

postgres=# ALTER USER bls WITH PASSWORD 'blstest';
```

Create a table called `bls_aggregator`:

```sh
sudo -u postgres createdb bls_aggregator
```

## Running

Can be run locally or hosted.

`deno run --allow-net --allow-env --allow-read  --unstable src/app/app.ts`

## Testing

- launch optimism
- deploy contract script
- run tests

NB each test must use unique address(es). (+ init code)

## Development

VSCode + Deno extension
