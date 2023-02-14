import { expect } from "chai";
import { ethers } from "ethers";

import { Experimental, BlsWalletWrapper } from "../src";
import { UncheckedBlsSigner } from "../src/BlsSigner";

let aggregatorUrl: string;
let verificationGateway: string;
let aggregatorUtilities: string;
let rpcUrl: string;
let network: ethers.providers.Networkish;

let privateKey: string;
let blsProvider: InstanceType<typeof Experimental.BlsProvider>;
let blsSigner: InstanceType<typeof Experimental.BlsSigner>;

describe("BlsSigner", () => {
  beforeEach(async () => {
    aggregatorUrl = "http://localhost:3000";
    verificationGateway = "mockVerificationGatewayAddress";
    aggregatorUtilities = "mockAggregatorUtilitiesAddress";
    rpcUrl = "http://localhost:8545";
    network = {
      name: "localhost",
      chainId: 0x7a69,
    };

    privateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();

    blsProvider = new Experimental.BlsProvider(
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
    expect(provider).to.be.instanceOf(Experimental.BlsProvider);
  });

  it("should detect whether an object is a valid signer", async () => {
    // Arrange & Act
    const validSigner = Experimental.BlsSigner.isSigner(blsSigner);
    const invalidSigner = Experimental.BlsSigner.isSigner({});

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
});
