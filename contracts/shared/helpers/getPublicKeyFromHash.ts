import { VerificationGateway } from "../../typechain-types";
import { PublicKey } from "../../clients/src";

export default async function getPublicKeyFromHash(
  verificationGateway: VerificationGateway,
  hash: string,
) {
  return (await Promise.all(
    [0, 1, 2, 3].map(async (i) =>
      (await verificationGateway.BLSPublicKeyFromHash(hash, i)).toHexString(),
    ),
  )) as PublicKey;
}
