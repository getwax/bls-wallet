# Aggregation service

Aggregates transactions signed with a BLS pub/priv key pair, for use with this [BLS Wallet](https://github.com/jzaki/bls-wallet)


## Development

Uses yarn, node express, typescript, mysql.

- clone repo (or just `./server`)
- yarn install
- `.envrc` from .envrc.example (`direnv` is useful to auto-load)
- Install/run mysql for your OS (Ubuntu: `apt install mysql-server`, `sudo systemctl start mysql`)

### tx aggregation server
- transpile typescript (watching for changes) - `yarn run watch-ts`
- run server (watching for changes) - `yarn run watch-node`
  - run server - `node dist/app/app.js`
