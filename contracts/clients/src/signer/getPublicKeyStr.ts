import * as hubbleBls from "../../deps/hubble-bls";
import getPublicKey from "./getPublicKey";

export default (
    signerFactory: hubbleBls.signer.BlsSignerFactory,
    domain: Uint8Array,
  ) =>
  (privateKey: string): string => {
    const [x0, x1, y0, y1] = getPublicKey(signerFactory, domain)(privateKey);
    return hubbleBls.mcl.dumpG2([
      x0.toString(),
      x1.toString(),
      y0.toString(),
      y1.toString(),
    ]);
  };
