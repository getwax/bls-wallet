/* eslint-disable camelcase */

import { expect } from "chai";
import { ethers } from "hardhat";
import { AddressRegistry, AddressRegistry__factory } from "../typechain-types";

describe("AddressRegistry", async () => {
  let addressRegistry: AddressRegistry;

  beforeEach(async () => {
    const [signer] = await ethers.getSigners();
    const addressRegistryFactory = new AddressRegistry__factory(signer);
    addressRegistry = await addressRegistryFactory.deploy();
  });

  it("should register address", async () => {
    const [signer] = await ethers.getSigners();
    const address = await signer.getAddress();

    await expect(addressRegistry.lookup(0)).to.be.revertedWith(
      "AddressRegistry: Address not found",
    );

    await addressRegistry.register(address);

    const address0 = await addressRegistry.lookup(0);
    expect(address0).to.equal(address);
  });

  it("should enable finding the id of an address", async () => {
    const [signer] = await ethers.getSigners();
    const address = await signer.getAddress();

    expect(await findAddressId(addressRegistry, address)).to.eq(undefined);

    await addressRegistry.register(address);

    expect(await findAddressId(addressRegistry, address)).to.eq(0);
  });
});

async function findAddressId(
  addressRegistry: AddressRegistry,
  address: string,
) {
  const events = await addressRegistry.queryFilter(
    addressRegistry.filters.AddressRegistered(null, address),
  );

  const id = events.at(0)?.args?.id;

  return id;
}
