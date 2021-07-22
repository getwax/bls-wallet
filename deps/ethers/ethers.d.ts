import {
  BaseContract,
  Contract,
  ContractFactory,
} from "https://cdn.skypack.dev/@ethersproject/contracts@5.4.0?dts";
import {
  BigNumber,
  FixedNumber,
} from "https://cdn.skypack.dev/@ethersproject/bignumber@5.4.0?dts";
import {
  Signer,
  VoidSigner,
} from "https://cdn.skypack.dev/@ethersproject/abstract-signer@5.4.0?dts";
import { Wallet } from "https://cdn.skypack.dev/@ethersproject/wallet@5.4.0?dts";
import * as constants from "https://cdn.skypack.dev/@ethersproject/constants@5.4.0?dts";
import * as providers from "./providers/index.d.ts";
// import * as providers from "https://cdn.skypack.dev/@ethersproject/providers@5.4.0?dts";
// import { getDefaultProvider } from "https://cdn.skypack.dev/@ethersproject/providers@5.4.0?dts";
import {
  Wordlist,
  wordlists,
} from "https://cdn.skypack.dev/@ethersproject/wordlists@5.4.0?dts";
import * as utils from "./utils.d.ts";
import { ErrorCode as errors } from "https://cdn.skypack.dev/@ethersproject/logger@5.4.0?dts";
import { BigNumberish } from "https://cdn.skypack.dev/@ethersproject/bignumber@5.4.0?dts";
import {
  Bytes,
  BytesLike,
  Signature,
} from "https://cdn.skypack.dev/@ethersproject/bytes@5.4.0?dts";
import {
  Transaction,
  UnsignedTransaction,
} from "https://cdn.skypack.dev/@ethersproject/transactions@5.4.0?dts";
import { version } from "./_version.d.ts";
declare const logger: utils.Logger;
import {
  CallOverrides,
  ContractFunction,
  ContractInterface,
  ContractReceipt,
  ContractTransaction,
  Event,
  EventFilter,
  Overrides,
  PayableOverrides,
  PopulatedTransaction,
} from "https://cdn.skypack.dev/@ethersproject/contracts@5.4.0?dts";
export {
  BaseContract,
  BigNumber,
  BigNumberish,
  Bytes,
  BytesLike,
  CallOverrides,
  constants,
  Contract,
  ContractFactory,
  ContractFunction,
  ContractInterface,
  ContractReceipt,
  ContractTransaction,
  errors,
  Event,
  EventFilter,
  FixedNumber,
  // getDefaultProvider,
  logger,
  Overrides,
  PayableOverrides,
  PopulatedTransaction,
  providers,
  Signature,
  Signer,
  Transaction,
  UnsignedTransaction,
  utils,
  version,
  VoidSigner,
  Wallet,
  Wordlist,
  wordlists,
};
