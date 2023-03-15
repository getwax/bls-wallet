/* eslint-disable camelcase */

import { expect } from "chai";
import { ethers } from "hardhat";
import { AddressRegistryWrapper } from "../clients/src";

describe("AddressRegistry", async () => {
  let addressRegistry: AddressRegistryWrapper;

  beforeEach(async () => {
    const [signer] = await ethers.getSigners();
    addressRegistry = await AddressRegistryWrapper.deployNew(signer);
  });

  it("should register address", async () => {
    const [signer] = await ethers.getSigners();
    const address = await signer.getAddress();

    await expect(addressRegistry.lookup(0)).to.eventually.eq(undefined);

    const id = await addressRegistry.register(address);
    expect(id).to.eq(0);

    const address0 = await addressRegistry.lookup(0);
    expect(address0).to.equal(address);
  });

  it("should enable finding the id of an address", async () => {
    const [signer] = await ethers.getSigners();
    const address = await signer.getAddress();

    const idBeforeRegister = await addressRegistry.reverseLookup(address);
    expect(idBeforeRegister).to.eq(undefined);

    const id = await addressRegistry.register(address);
    expect(id).to.eq(0);

    const idAfterRegister = await addressRegistry.reverseLookup(address);
    expect(idAfterRegister).to.eq(0);
  });
});
