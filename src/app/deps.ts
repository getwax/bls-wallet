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
export {
  BigNumber,
  Contract,
  ethers,
  Wallet,
  // } from "https://cdn.ethers.io/lib/ethers-5.0.esm.min.js";
} from "https://unpkg.com/ethers@5.1.3/dist/ethers.esm.js?module";
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
} from "https://deno.land/x/postquery@0.0.3/mod.ts";

export type { TableOptions } from "https://deno.land/x/postquery@0.0.3/mod.ts";
