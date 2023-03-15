/* eslint-disable camelcase */

import { expect } from "chai";
import { BigNumber } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";
import type { PublicKey } from "../clients/src";
import {
  BLSPublicKeyRegistry,
  BLSPublicKeyRegistry__factory,
} from "../typechain-types";

const blsPublicKey = [
  "0x2fa5eae26e850147f76823375b9ee060fdb3838c8ec31e89c44aadf1cb3360b8",
  "0x09be12ff0323692301d9cdd7e6740cd8ab3fc17e3eadf2edb1d32d3d98c76939",
  "0x1d69e92b863636811081c60132f18a6c41281f75f6c2816ac255a9af13f2b416",
  "0x099f53b1005b1f53be13a30c71fa32e785bc516508fda055cf22f7ab33580412",
].map((x) => BigNumber.from(x)) as PublicKey;

describe("BLSPublicKeyRegistry", async () => {
  let blsPublicKeyRegistry: BLSPublicKeyRegistry;

  beforeEach(async () => {
    const [signer] = await ethers.getSigners();
    const blsPublicKeyRegistryFactory = new BLSPublicKeyRegistry__factory(
      signer,
    );
    blsPublicKeyRegistry = await blsPublicKeyRegistryFactory.deploy();
  });

  it("should register BLS public key", async () => {
    await expect(blsPublicKeyRegistry.lookup(0)).to.be.revertedWith(
      "BLSPublicKeyRegistry: BLS public key not found",
    );

    await blsPublicKeyRegistry.register(blsPublicKey);

    const blsPublicKey0 = await blsPublicKeyRegistry.lookup(0);

    expect(blsPublicKey0).to.deep.equal(blsPublicKey);
  });

  it("should enable finding the id of an BLS public key", async () => {
    expect(await findBLSPublicKeyId(blsPublicKeyRegistry, blsPublicKey)).to.eq(
      undefined,
    );

    await blsPublicKeyRegistry.register(blsPublicKey);

    // Doesn't seem like much to find id 0, but without the indexed event we'd
    // need to store the reverse mapping on-chain (in expensive regular storage)
    // or in a centralized off-chain database.
    expect(await findBLSPublicKeyId(blsPublicKeyRegistry, blsPublicKey)).to.eq(
      0,
    );
  });
});

async function findBLSPublicKeyId(
  blsPublicKeyRegistry: BLSPublicKeyRegistry,
  blsPublicKey: PublicKey,
) {
  const blsPublicKeyHash = solidityKeccak256(["uint256[4]"], [blsPublicKey]);

  const events = await blsPublicKeyRegistry.queryFilter(
    blsPublicKeyRegistry.filters.BLSPublicKeyRegistered(null, blsPublicKeyHash),
  );

  const id = events.at(0)?.args?.id;

  return id;
}
