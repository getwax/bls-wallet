import Client from "../src/app/Client.ts";
import * as env from "../src/env.ts";

const client = new Client(`http://localhost:${env.PORT}`);

const failures = await client.addTransaction(tx);
