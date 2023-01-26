import { mcl } from "@thehubbleproject/bls";

export default (): string => {
  return `0x${mcl.randFr().serializeToHexStr()}`;
};
