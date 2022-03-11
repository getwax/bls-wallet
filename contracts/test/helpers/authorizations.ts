import { BigNumber, BytesLike, ethers } from "ethers";
import {
  ActionData,
  BlsWalletWrapper,
  PublicKey,
  Signature,
} from "../../clients/src";

const PROXY_ADMIN_FUNCTION_HASH_AUTH_ID =
  // keccak256("proxyAdminFunctionHash")
  "0xf7f75a0694ef66d3fbc2b1c58fa96cc5a0e85d8f7ef5e4663a2c37c339b3cb9e";

// const RECOVERY_HASH_AUTH_ID =
//   // keccak256("recoveryHash")
//   "0x27690924264ef7d5a40864fd354bdcd43328b7f9e2b82210e410627ee6f95983";

const SET_TRUSTED_GATEWAY_AUTH_ID =
  // keccak256("setTrustedGateway")
  "0xb763883050766a187f540d60588b1051834a12c4a984a0646e5e062f80efc831";

const SET_EXTERNAL_WALLET_AUTH_ID =
  // keccak256("setExternalWallet")
  "0xdafdb408a06a21a633291daa7073ef64b3bbe7a6d37a2bb0b36930589bbf458a";

const AUTH_DELAY =
  // 7 days
  604800;

export function authorizeProxyAdminFunction(
  wallet: BlsWalletWrapper,
  encodedFunction: BytesLike,
): ActionData {
  return {
    ethValue: BigNumber.from(0),
    contractAddress: wallet.address,
    encodedFunction: wallet.walletContract.interface.encodeFunctionData(
      "authorize",
      [
        PROXY_ADMIN_FUNCTION_HASH_AUTH_ID,
        AUTH_DELAY,
        ethers.utils.keccak256(encodedFunction),
      ],
    ),
  };
}

export function authorizeSetExternalWallet(
  wallet: BlsWalletWrapper,
  signature: Signature,
  publicKey: PublicKey,
) {
  return {
    ethValue: BigNumber.from(0),
    contractAddress: wallet.address,
    encodedFunction: wallet.walletContract.interface.encodeFunctionData(
      "authorize",
      [
        SET_EXTERNAL_WALLET_AUTH_ID,
        AUTH_DELAY,
        ethers.utils.solidityKeccak256(
          ["uint256[2]", "uint256[4]"],
          [signature, publicKey],
        ),
      ],
    ),
  };
}

export function authorizeSetTrustedGateway(
  wallet: BlsWalletWrapper,
  newGatewayAddress: string,
) {
  return {
    ethValue: BigNumber.from(0),
    contractAddress: wallet.address,
    encodedFunction: wallet.walletContract.interface.encodeFunctionData(
      "authorize",
      [
        SET_TRUSTED_GATEWAY_AUTH_ID,
        AUTH_DELAY,
        ethers.utils.defaultAbiCoder.encode(["address"], [newGatewayAddress]),
      ],
    ),
  };
}
