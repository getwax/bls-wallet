import { expect } from "chai";

import { ethers, network } from "hardhat";

import Fixture from "../shared/helpers/Fixture";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";
import defaultDomain from "../clients/src/signer/defaultDomain";

import {
  authorizeSetOwner,
  authorizeSetPublicKey,
} from "./helpers/authorizations";
import { BlsWalletWrapper } from "../clients/src";
import { solidityPack } from "ethers/lib/utils";
import { solG1 } from "../clients/deps/hubble-bls/mcl";
import { BlsSignerFactory } from "../clients/deps/hubble-bls/signer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const signWalletAddress = async (
  senderAddr: string,
  signerPrivKey: string,
): Promise<solG1> => {
  const addressMessage = solidityPack(["address"], [senderAddr]);
  const blsSigner = (await BlsSignerFactory.new()).getSigner(
    defaultDomain,
    signerPrivKey,
  );
  return blsSigner.sign(addressMessage);
};

async function setOwner(
  fx: Fixture,
  wallet: BlsWalletWrapper,
  newOwner: string,
) {
  await (
    await fx.verificationGateway.processBundle(
      wallet.sign({
        nonce: await wallet.Nonce(),
        actions: [
          {
            ethValue: 0,
            contractAddress: wallet.address,
            encodedFunction: wallet.walletContract.interface.encodeFunctionData(
              "setOwner",
              [newOwner],
            ),
          },
        ],
      }),
    )
  ).wait();
}

describe("Recovery", async function () {
  this.beforeAll(async function () {
    // deploy the deployer contract for the transient hardhat network
    if (network.name === "hardhat") {
      // fund deployer wallet address
      const fundedSigner = (await ethers.getSigners())[0];
      await (
        await fundedSigner.sendTransaction({
          to: defaultDeployerAddress(),
          value: ethers.utils.parseEther("1"),
        })
      ).wait();

      // deploy the precompile contract (via deployer)
      console.log("PCE:", await deployAndRunPrecompileCostEstimator());
    }
  });

  const safetyDelaySeconds = 7 * 24 * 60 * 60;
  let fx: Fixture;
  let wallet1: BlsWalletWrapper, walletAttacker;
  let recoverySigner: SignerWithAddress;
  beforeEach(async function () {
    fx = await Fixture.create();

    wallet1 = await fx.lazyBlsWallets[0]();
    walletAttacker = await fx.lazyBlsWallets[2]();
    recoverySigner = (await ethers.getSigners())[1];
  });

  it("should set owner", async function () {
    // Owner starts as address zero (owned by noone)
    expect(await wallet1.walletContract.owner()).to.eq(
      ethers.constants.AddressZero,
    );

    await setOwner(fx, wallet1, recoverySigner.address);

    // The first time it should work without any set up
    expect(await wallet1.walletContract.owner()).to.eq(recoverySigner.address);

    await setOwner(fx, wallet1, ethers.constants.AddressZero);

    // Second time it should fail without some set-up
    expect(await wallet1.walletContract.owner()).to.eq(recoverySigner.address);

    await (
      await fx.verificationGateway.processBundle(
        wallet1.sign({
          nonce: await wallet1.Nonce(),
          actions: [authorizeSetOwner(wallet1, ethers.constants.AddressZero)],
        }),
      )
    ).wait();

    await setOwner(fx, wallet1, ethers.constants.AddressZero);

    // Auth above is necessary but it's not valid until the delay has passed
    expect(await wallet1.walletContract.owner()).to.eq(recoverySigner.address);

    await fx.advanceTimeBy(safetyDelaySeconds);

    await setOwner(fx, wallet1, ethers.constants.AddressZero);

    expect(await wallet1.walletContract.owner()).to.eq(
      ethers.constants.AddressZero,
    );
  });

  recoveryPreventsAttackerFromChangingBlsKey({ callRecover: true });
  recoveryPreventsAttackerFromChangingBlsKey({ callRecover: false });

  function recoveryPreventsAttackerFromChangingBlsKey(opt: {
    callRecover: boolean;
  }) {
    it(`recovery prevents attacker from changing bls key ${JSON.stringify(
      opt,
    )}`, async () => {
      const { callRecover } = opt;

      await setOwner(fx, wallet1, recoverySigner.address);
      const attackKey = walletAttacker.PublicKey();

      // Attacker assumed to have compromised current bls key, and wishes to reset
      // the contract's bls key to their own.
      await fx.verificationGateway.processBundle(
        wallet1.sign({
          nonce: await wallet1.Nonce(),
          actions: [
            authorizeSetPublicKey(
              wallet1,
              await signWalletAddress(
                wallet1.address,
                walletAttacker.privateKey,
              ),
              wallet1.blsWalletSigner.getPublicKeyHash(wallet1.privateKey),
              attackKey,
            ),
          ],
        }),
      );

      await fx.advanceTimeBy(safetyDelaySeconds / 2); // wait half the time

      if (callRecover) {
        // Owner intervenes by calling recover
        await (
          await wallet1.walletContract.connect(recoverySigner).recover()
        ).wait();
      }

      await fx.advanceTimeBy(safetyDelaySeconds / 2 + 1); // wait remainder the time

      try {
        await (
          await fx.verificationGateway.processBundle(
            wallet1.sign({
              nonce: await wallet1.Nonce(),
              actions: [
                {
                  ethValue: 0,
                  contractAddress: fx.verificationGateway.address,
                  encodedFunction:
                    fx.verificationGateway.interface.encodeFunctionData(
                      "setPublicKey",
                      [
                        await signWalletAddress(
                          wallet1.address,
                          walletAttacker.privateKey,
                        ),
                        wallet1.blsWalletSigner.getPublicKeyHash(
                          wallet1.privateKey,
                        ),
                        attackKey,
                      ],
                    ),
                },
              ],
            }),
          )
        ).wait();
      } catch {
        // Currently this will throw due to a bug:
        // https://github.com/jzaki/bls-wallet/issues/169
        // That's not the concern right now though, the point is just that the
        // attacker is unable to map a new public key.
      }

      const attackKeyWallet = await fx.verificationGateway.walletFromHash(
        walletAttacker.blsWalletSigner.getPublicKeyHash(
          walletAttacker.privateKey,
        ),
      );

      if (!callRecover) {
        expect(attackKeyWallet).to.eq(wallet1.address);
      } else {
        expect(attackKeyWallet).not.to.eq(wallet1.address);

        // Check that we can perform operations directly on the recovered wallet
        await (
          await wallet1.walletContract
            .connect(recoverySigner)
            .performOperation({
              nonce: await wallet1.Nonce(),
              actions: [],
            })
        ).wait();
      }
    });
  }
});
