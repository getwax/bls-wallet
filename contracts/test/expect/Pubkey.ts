import { BigNumber } from "ethers";
import { expect } from "chai";
import { PublicKey } from "../../clients/src";

const pubkeyToHex = (pubkey: PublicKey): [string, string, string, string] => {
  return pubkey.map((pubkeySeg) => BigNumber.from(pubkeySeg).toHexString());
};

export const expectPubkeysEql = (
  pubkeyActual: PublicKey,
  pubkeyExpected: PublicKey,
) => {
  expect(pubkeyToHex(pubkeyActual)).to.deep.equal(pubkeyToHex(pubkeyExpected));
};

export const expectPubkeysNotEql = (
  pubkeyActual: PublicKey,
  pubkeyExpected: PublicKey,
) => {
  expect(pubkeyToHex(pubkeyActual)).to.not.deep.equal(
    pubkeyToHex(pubkeyExpected),
  );
};
