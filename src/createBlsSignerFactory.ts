import { signer } from "../deps/hubble-bls";

export default function createBlsSignerFactory(
): Promise<signer.BlsSignerFactory> {
  return signer.BlsSignerFactory.new();
}
