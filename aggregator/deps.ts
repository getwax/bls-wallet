export { delay } from "https://deno.land/std@0.103.0/async/delay.ts";
export { parse as parseArgs } from "https://deno.land/std@0.103.0/flags/mod.ts";
export { exists } from "https://deno.land/std@0.103.0/fs/mod.ts";
export { dirname } from "https://deno.land/std@0.103.0/path/mod.ts";
export { oakCors } from "https://deno.land/x/cors@v1.2.0/mod.ts";

import { config as dotEnvConfig } from "https://deno.land/x/dotenv@v2.0.0/mod.ts";
export { dotEnvConfig };

// Oak framework dependencies
export {
  Application,
  Request,
  Response,
  Router,
  Status as HTTPStatus,
} from "https://deno.land/x/oak@v7.5.0/mod.ts";

export type {
  HTTPMethods,
  Middleware,
  RouterContext,
} from "https://deno.land/x/oak@v7.5.0/mod.ts";

export {
  BigNumber,
  Contract,
  ethers,
  Wallet,
} from "https://esm.sh/ethers@5.7.2";

import { ethers } from "https://esm.sh/ethers@5.7.2";
export type {
  BaseContract,
  BigNumberish,
  BytesLike,
} from "https://esm.sh/ethers@5.7.2";
export const keccak256 = ethers.utils.keccak256;

// Adding more accurate type information here (ethers uses Array<any>)
export const shuffled: <T>(array: T[]) => T[] = ethers.utils.shuffled;

export type {
  AggregatorUtilities,
  BlsWalletSigner,
  Bundle,
  BundleDto,
  ERC20,
  MockERC20,
  NetworkConfig,
  Operation,
  OperationResultError,
  PublicKey,
  Signature,
  VerificationGateway,
} from "https://esm.sh/bls-wallet-clients@0.8.2-77f1638";

export {
  Aggregator as AggregatorClient,
  AggregatorUtilities__factory,
  BlsWalletWrapper,
  decodeError,
  ERC20__factory,
  getConfig,
  MockERC20__factory,
  VerificationGateway__factory,
} from "https://esm.sh/bls-wallet-clients@0.8.2-77f1638";

// Workaround for esbuild's export-star bug
import blsWalletClients from "https://esm.sh/bls-wallet-clients@0.8.2-77f1638";
const { bundleFromDto, bundleToDto, initBlsWalletSigner } = blsWalletClients;
export { bundleFromDto, bundleToDto, initBlsWalletSigner };

export * as sqlite from "https://deno.land/x/sqlite@v3.7.0/mod.ts";
export { Semaphore } from "https://deno.land/x/semaphore@v1.1.2/mod.ts";
