import { arrayify, solidityPack } from "ethers/lib/utils";
import { utils } from "ethers";

export default (
  name: string,
  version: string,
  chainId: number,
  verificationGatewayAddress: string,
  type: string,
): Uint8Array => {
  const encoded = solidityPack(
    ["string", "string", "uint256", "address", "string"],
    [name, version, chainId, verificationGatewayAddress, type],
  );

  return arrayify(utils.keccak256(encoded));
};
