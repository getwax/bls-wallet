import { mcl } from "@thehubbleproject/bls";

export default async (): Promise<string> => {
  await mcl.init();
  return `0x${mcl.randFr().serializeToHexStr()}`;
};
