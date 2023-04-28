import { BigNumberish, ethers } from "ethers";
import { Bundle, Operation } from "../signer";

type BundleWithoutSignature = {
  senderPublicKeys: [BigNumberish, BigNumberish, BigNumberish, BigNumberish];
  operations: Omit<Operation, "gas">;
};

export function hashBundle(bundle: Bundle, chainId: number): string {
  if (bundle.operations.length !== bundle.senderPublicKeys.length) {
    throw new Error(
      "number of operations does not match number of public keys",
    );
  }

  const bundlesWithoutSignature: Array<BundleWithoutSignature> =
    bundle.operations.map((operation, index) => ({
      senderPublicKeys: bundle.senderPublicKeys[index],
      operations: {
        nonce: operation.nonce,
        actions: operation.actions,
      },
    }));

  const serializedBundlesWithoutSignature = bundlesWithoutSignature.map(
    (bundleWithoutSignature) => {
      return JSON.stringify({
        senderPublicKeys: bundleWithoutSignature.senderPublicKeys,
        operations: bundleWithoutSignature.operations,
      });
    },
  );

  const bundleSubHashes = serializedBundlesWithoutSignature.map(
    async (serializedBundleWithoutSignature) => {
      const bundleHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(serializedBundleWithoutSignature),
      );

      const encoding = ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "uint256"],
        [bundleHash, chainId],
      );
      return ethers.utils.keccak256(encoding);
    },
  );

  const concatenatedHashes = bundleSubHashes.join("");
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(concatenatedHashes));
}
