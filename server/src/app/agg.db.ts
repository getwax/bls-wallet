import mysql from 'mysql';
import Knex, { QueryBuilder } from 'knex';
import { exit } from 'node:process';

const PG_HOST = "localhost";
const PG_USER = "bls";
const PG_PASSWORD = "blstest";
const PG_DB_NAME = "bls_aggregator";
const PG_PORT = 5432;

namespace db {
  let knex:Knex;

  export async function init() {
    knex = Knex({
      client: 'pg',
      connection: {
        host : PG_HOST,
        user : PG_USER,
        password : PG_PASSWORD,
        database : PG_DB_NAME,
        port: PG_PORT || 3306
      }
    });
    
    if (!(await knex.schema.hasTable('txs'))) {
      createTable();
    }
  }

  export async function resetTable() {
    if (await knex.schema.hasTable('txs')) {
      await knex.schema.dropTable('txs');
    }
    await createTable();
  }

  async function createTable() {
    let table = knex.schema.createTable('txs', function(t) {
      t.increments('tx_id').primary();
      t.specificType('bls_pub_key', 'varchar(66)[]');
      t.string('sender', 42);
      t.specificType('message', 'varchar(66)[]');
      t.specificType('signature', 'bigint[]');
      t.string('recipient', 42);
      t.string('amount', 66);
    });
    console.log("\n", table.toString());
    try {
      await table;
    }
    catch(err) {
      console.error(err);
    }
  }

  export function addTx(txData: any) {
    let insert = knex('txs').insert({
      'bls_pub_key': txData.pubKey,
      'sender': txData.sender,
      'message': txData.messagePoints,
      'signature': Object.values(txData.signature.a_),
      'recipient': txData.recipient,
      'amount': txData.amount
    });
    console.log("\nAdded tx");//, insert.toString());
    insert.then()
    .catch( err => console.error(err) );
  }

  export async function txCount(): Promise<number> {
    let c = -1;
    try {
      let res = await knex('txs').count();
      c = res[0].count as number;
    }
    catch(err) {
      console.error(err);
    }
    return c;
  }  

}


export default db;
