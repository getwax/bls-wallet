import { BigNumber, ethers } from "ethers";
import { Bundle } from "../signer";
import { VerificationGatewayFactory } from "../index";

/**
 * Generates a deterministic hash of a bundle. Because the signature of the bundle could change, along with the gas property on operations,
 * those values are set to 0 before hashing. This leads to a more consistent hash for variations of the same bundle.
 *
 * @remarks the hash output is senstive to the internal types of the bundle. For example, an identical bundle with a
 * BigNumber value for one of the properties, vs the same bundle with a hex string value for one of the properties, will
 * generate different hashes, even though the underlying value may be the same.
 *
 * @param bundle the signed bundle to generate the hash for
 * @param chainId the chain id of the network the bundle is being submitted to
 * @returns a deterministic hash of the bundle
 */
export default function hashBundle(bundle: Bundle, chainId: number): string {
  if (bundle.operations.length !== bundle.senderPublicKeys.length) {
    throw new Error(
      "number of operations does not match number of public keys",
    );
  }

  const operationsWithZeroGas = bundle.operations.map((operation) => {
    return {
      ...operation,
      gas: BigNumber.from(0),
    };
  });

  const verifyMethodName = "verify";
  const bundleType = VerificationGatewayFactory.abi.find(
    (entry) => "name" in entry && entry.name === verifyMethodName,
  )?.inputs[0];

  const validatedBundle = {
    ...bundle,
    operations: operationsWithZeroGas,
  };

  const encodedBundleWithZeroSignature = ethers.utils.defaultAbiCoder.encode(
    [bundleType as any],
    [
      {
        ...validatedBundle,
        signature: [BigNumber.from(0), BigNumber.from(0)],
      },
    ],
  );

  const bundleHash = ethers.utils.keccak256(encodedBundleWithZeroSignature);

  const encoding = ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "uint256"],
    [bundleHash, chainId],
  );
  return ethers.utils.keccak256(encoding);
}
