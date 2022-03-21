import { BigNumber, BytesLike, ethers } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import {
  ActionData,
  BlsWalletWrapper,
  PublicKey,
  Signature,
} from "../../clients/src";

export const PROXY_ADMIN_FUNCTION_HASH_AUTH_ID =
  // keccak256("proxyAdminFunctionHash")
  "0xf7f75a0694ef66d3fbc2b1c58fa96cc5a0e85d8f7ef5e4663a2c37c339b3cb9e";

export const SET_OWNER_AUTH_ID =
  // keccak256("setOwner")
  "0x8e83b6bc9dcf1c432a6983224abae519957e953d14e2d66d9d36206b86a15cce";

export const SET_TRUSTED_GATEWAY_AUTH_ID =
  // keccak256("setTrustedGateway")
  "0xb763883050766a187f540d60588b1051834a12c4a984a0646e5e062f80efc831";

export const SET_PUBLIC_KEY_AUTH_ID =
  // keccak256("setExternalWallet")
  "0xe8bc0eb87884ab91e330445c3584a50d7ddf4b568f02fbeb456a6242cce3f5d9";

export const AUTH_DELAY =
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

export function authorizeSetPublicKey(
  wallet: BlsWalletWrapper,
  signature: Signature,
  oldPublicKeyHash: BytesLike,
  newPublicKey: PublicKey,
): ActionData {
  return {
    ethValue: BigNumber.from(0),
    contractAddress: wallet.address,
    encodedFunction: wallet.walletContract.interface.encodeFunctionData(
      "authorize",
      [
        SET_PUBLIC_KEY_AUTH_ID,
        AUTH_DELAY,
        ethers.utils.solidityKeccak256(
          ["uint256[2]", "bytes32", "uint256[4]"],
          [signature, oldPublicKeyHash, newPublicKey],
        ),
      ],
    ),
  };
}

export function authorizeSetTrustedGateway(
  wallet: BlsWalletWrapper,
  newGatewayAddress: string,
): ActionData {
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

export function authorizeSetOwner(
  wallet: BlsWalletWrapper,
  newOwner: string,
): ActionData {
  return {
    ethValue: BigNumber.from(0),
    contractAddress: wallet.address,
    encodedFunction: wallet.walletContract.interface.encodeFunctionData(
      "authorize",
      [
        SET_OWNER_AUTH_ID,
        AUTH_DELAY,
        solidityKeccak256(["address"], [newOwner]),
      ],
    ),
  };
}
