// import { Client } from "./deps.ts";
import {
  QueryClient,
  DataType,
  Constraint,
  CreateTableMode
} from "./deps.ts";

const PG_HOST = "localhost";
const PG_PORT = 5432;
const PG_USER = "bls";
const PG_PASSWORD = "blstest";
export const PG_DB_NAME = "bls_aggregator";
export const TX_TABLE_NAME = "txs";

const client = new QueryClient({
  hostname : PG_HOST,
  port: PG_PORT,
  user : PG_USER,
  password : PG_PASSWORD,
  database : PG_DB_NAME,
  tls: {
    enforce: false
  }
})

export type TransactionData = {
  txId?: number,
  blsPubKey: string[]
  sender: string,
  message: string[],
  signature: string,
  recipient: string,
  amount: string
};

const txTable = client.table<TransactionData>("txs");

const run = async() => {
  
  await txTable.create({
    txId: { type: DataType.Serial, constrait: Constraint.PrimaryKey },
    blsPubKey: { type: DataType.VarChar, length: 66, array: true },
    sender: { type: DataType.VarChar, length: 42 },
    message: { type: DataType.VarChar, length: 66, array: true },
    signature: { type: DataType.VarChar, length: 64 },
    recipient: { type: DataType.VarChar, length: 42 },
    amount: { type: DataType.VarChar, length: 66 },
  }, CreateTableMode.DropIfExists);

}

run();

export { client, txTable };
