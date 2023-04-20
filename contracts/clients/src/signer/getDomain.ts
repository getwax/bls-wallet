import { arrayify, solidityPack } from "ethers/lib/utils";
import { utils } from "ethers";

export default (
  chainId: number,
  verificationGatewayAddress: string,
  type: string,
): Uint8Array => {
  const encoded = solidityPack(
    ["uint256", "address", "string"],
    [chainId, verificationGatewayAddress, type],
  );

  return arrayify(utils.keccak256(encoded));
};
