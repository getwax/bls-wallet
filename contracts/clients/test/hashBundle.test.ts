import { expect } from "chai";
import { hashBundle } from "../src/helpers/hashBundle";
import { Bundle } from "../src";
import { BigNumber } from "ethers";

describe("hashBundle", () => {
  it("should return a valid hash when provided with a valid bundle and chainId", () => {
    // Arrange
    const operation = {
      nonce: BigNumber.from(123),
      gas: 30_000_000,
      actions: [],
    };

    const bundle: Bundle = {
      signature: ["0x1234", "0x1234"],
      operations: [operation, operation],
      senderPublicKeys: [
        ["0x4321", "0x4321", "0x4321", "0x4321"],
        ["0x4321", "0x4321", "0x4321", "0x4321"],
      ],
    };
    const chainId = 1;

    // Act
    const result = hashBundle(bundle, chainId);

    // Assert
    expect(result).to.be.a("string");
    expect(result.length).to.equal(66); // A keccak256 hash is 32 bytes, or 64 characters, plus the "0x" prefix
  });

  it("should throw an error when the number of operations does not match the number of public keys", () => {
    // Arrange
    const operation = {
      nonce: BigNumber.from(123),
      gas: 30_000_000,
      actions: [],
    };

    const bundle1: Bundle = {
      signature: ["0x1234", "0x1234"],
      operations: [operation, operation],
      senderPublicKeys: [["0x4321", "0x4321", "0x4321", "0x4321"]],
    };
    const bundle2: Bundle = {
      signature: ["0x1234", "0x1234"],
      operations: [operation],
      senderPublicKeys: [
        ["0x4321", "0x4321", "0x4321", "0x4321"],
        ["0x4321", "0x4321", "0x4321", "0x4321"],
      ],
    };
    const chainId = 1;

    // Act & Assert
    expect(() => hashBundle(bundle1, chainId)).to.throw(
      "number of operations does not match number of public keys",
    );

    expect(() => hashBundle(bundle2, chainId)).to.throw(
      "number of operations does not match number of public keys",
    );
  });
});
