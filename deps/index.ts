import { config as dotEnvConfig } from "https://deno.land/x/dotenv@v2.0.0/mod.ts";
export { dotEnvConfig };

// Oak framework dependencies
export {
  Application,
  Request,
  Response,
  Router,
} from "https://deno.land/x/oak@v7.3.0/mod.ts";

export type { RouterContext } from "https://deno.land/x/oak@v7.3.0/mod.ts";

// Ethers dependencies
import ethers from "./ethers/index.ts";

export { default as ethers } from "./ethers/index.ts";

export const BigNumber = ethers.BigNumber;
export type BigNumber = ethers.BigNumber;

export const Contract = ethers.Contract;
export type Contract = ethers.Contract;

export const Wallet = ethers.Wallet;
export type Wallet = ethers.Wallet;

// // // Ethers dependencies
// export {
//   // BigNumber,
//   // Contract,
//   default as ethers,
//   // Wallet,
// } from "./ethers/index.ts";
// } from "https://unpkg.com/ethers@5.1.3/dist/ethers.esm.js?module";
// } from "https://unpkg.com/ethers?module";
// } from "https://cdn.skypack.dev/ethers"; // error: "hash.js" no dep found
// } from "https://cdn.skypack.dev/ethers?min"; // error: reference in own type annotation
// } from "https://cdn.skypack.dev/ethers@v5.1.3?dts";

// import { Contract } from "https://cdn.skypack.dev/@ethersproject/contracts?dts";
// import { Wallet } from "https://cdn.skypack.dev/@ethersproject/wallet?dts";

// import dew from "https://dev.jspm.io/ethers";
// const ContractClass = (dew as any).Contract;
// export type Contract = typeof ContractClass;

// import tsGenerator from 'https://cdn.skypack.dev/@typechain/ts-generator';

// Database dependencies
export {
  Constraint,
  CreateTableMode,
  DataType,
  QueryClient,
  QueryTable,
} from "https://deno.land/x/postquery@v0.0.3/mod.ts";

export type { TableOptions } from "https://deno.land/x/postquery@v0.0.3/mod.ts";
