import { BigNumber } from "ethers";
import { solidityPack } from "ethers/lib/utils";
import { Bundle, BundleDto } from "./types";

export function bundleToDto(bundle: Bundle): BundleDto {
  return {
    senderPublicKeys: bundle.senderPublicKeys.map(([n0, n1, n2, n3]) => [
      BigNumber.from(n0).toHexString(),
      BigNumber.from(n1).toHexString(),
      BigNumber.from(n2).toHexString(),
      BigNumber.from(n3).toHexString(),
    ]),
    operations: bundle.operations.map((op) => ({
      nonce: BigNumber.from(op.nonce).toHexString(),
      actions: op.actions.map((a) => ({
        ethValue: BigNumber.from(a.ethValue).toHexString(),
        contractAddress: a.contractAddress,
        encodedFunction:
          typeof a.encodedFunction === "string"
            ? a.encodedFunction
            : solidityPack(["bytes"], [a.encodedFunction]),
      })),
    })),
    signature: [
      BigNumber.from(bundle.signature[0]).toHexString(),
      BigNumber.from(bundle.signature[1]).toHexString(),
    ],
  };
}

export function bundleFromDto(bundleDto: BundleDto): Bundle {
  // Because the Bundle type comes from typechain and those types are permissive
  // (e.g. BigNumberish which can be a BigNumber), a BundleDto is actually a
  // valid Bundle. The reverse is not true though - a Bundle is not necessarily
  // a valid BundleDto.
  return bundleDto;
}
