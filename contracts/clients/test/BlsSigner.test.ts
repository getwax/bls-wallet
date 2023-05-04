import { expect } from "chai";
import { BigNumber, ethers } from "ethers";

import { BlsProvider, BlsSigner } from "../src";
import { UncheckedBlsSigner } from "../src/BlsSigner";

let aggregatorUrl: string;
let verificationGateway: string;
let aggregatorUtilities: string;
let rpcUrl: string;
let network: ethers.providers.Networkish;

let privateKey: string;
let blsProvider: BlsProvider;
let blsSigner: BlsSigner;

describe("BlsSigner", () => {
  beforeEach(async () => {
    aggregatorUrl = "http://localhost:3000";
    verificationGateway = "0xC8CD2BE653759aed7B0996315821AAe71e1FEAdF";
    aggregatorUtilities = "0xC8CD2BE653759aed7B0996315821AAe71e1FEAdF";
    rpcUrl = "http://localhost:8545";
    network = {
      name: "localhost",
      chainId: 0x539,
    };

    privateKey = await BlsSigner.getRandomBlsPrivateKey();

    blsProvider = new BlsProvider(
      aggregatorUrl,
      verificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );
    blsSigner = blsProvider.getSigner(privateKey);
  });

  it("should connect to an unchecked bls signer", () => {
    // Arrange & Act
    const uncheckedBlsSigner = blsSigner.connectUnchecked();

    // Assert
    expect(uncheckedBlsSigner._isSigner).to.be.true;
    expect(uncheckedBlsSigner).to.be.instanceOf(UncheckedBlsSigner);
  });

  it("should throw an error when ENS name is not a string", async () => {
    // Arrange
    const ensName = null as unknown as string;

    // Act
    const result = async () => await blsSigner.resolveName(ensName);

    // Assert
    await expect(result()).to.be.rejectedWith(Error, "invalid ENS name");
  });

  it("should throw an error when ENS name fails formatting checks", async () => {
    // Arrange
    const ensName = ethers.utils.formatBytes32String("invalid");

    // Act
    const result = async () => await blsSigner.resolveName(ensName);

    // Assert
    await expect(result()).to.be.rejectedWith(Error, "invalid address");
  });

  it("should return the provider the signer was established from", async () => {
    // Arrange & Act
    const provider = blsSigner.provider;

    // Assert
    expect(provider._isProvider).to.be.true;
    expect(provider).to.be.instanceOf(BlsProvider);
  });

  it("should detect whether an object is a valid signer", async () => {
    // Arrange & Act
    const validSigner = BlsSigner.isSigner(blsSigner);
    const invalidSigner = BlsSigner.isSigner({});

    // Assert
    expect(validSigner).to.be.true;
    expect(invalidSigner).to.be.false;
  });

  it("should throw an error if attempt to change provider is made", async () => {
    // Arrange & Act
    const connect = () => blsSigner.connect(blsProvider);

    // Assert
    expect(connect).to.throw(Error, "cannot alter JSON-RPC Signer connection");
  });

  it("should throw error for wrong chain id when validating batch options", async () => {
    // Arrange
    const invalidChainId = 123;
    const batchOptions = {
      gas: BigNumber.from("40000"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("0.5", "gwei"),
      maxFeePerGas: ethers.utils.parseUnits("23", "gwei"),
      nonce: 1,
      chainId: invalidChainId,
      accessList: [],
    };

    // Act
    const result = async () =>
      await blsSigner._validateBatchOptions(batchOptions);

    // Assert
    expect(result()).to.be.rejectedWith(
      Error,
      `Supplied chain ID ${invalidChainId} does not match the expected chain ID 1337`,
    );
  });
});
