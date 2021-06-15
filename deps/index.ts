import { config as dotEnvConfig } from "https://deno.land/x/dotenv@v2.0.0/mod.ts";
export { dotEnvConfig };

// Oak framework dependencies
export {
  Application,
  Request,
  Response,
  Router,
} from "https://deno.land/x/oak@v7.5.0/mod.ts";

export type {
  Middleware,
  RouterContext,
} from "https://deno.land/x/oak@v7.5.0/mod.ts";

// Ethers dependencies
import ethers from "./ethers/index.ts";

export { default as ethers } from "./ethers/index.ts";

export const BigNumber = ethers.BigNumber;
export type BigNumber = ethers.BigNumber;

export const Contract = ethers.Contract;
export type Contract = ethers.Contract;

export const Wallet = ethers.Wallet;
export type Wallet = ethers.Wallet;

// Database dependencies
export {
  Constraint,
  CreateTableMode,
  DataType,
  QueryClient,
  QueryTable,
} from "https://deno.land/x/postquery@v0.0.4/mod.ts";

export type { TableOptions } from "https://deno.land/x/postquery@v0.0.4/mod.ts";

import * as hubbleBlsImport from "./hubble-bls/mod.ts";
await hubbleBlsImport.mcl.init();

export * as hubbleBls from "./hubble-bls/mod.ts";
