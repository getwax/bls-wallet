import { TokenRegistryFactory } from "../types/ethers-contracts/TokenRegistryFactory";
import { TransferFactory } from "../types/ethers-contracts/TransferFactory";
import { MassMigrationFactory } from "../types/ethers-contracts/MassMigrationFactory";
import { ExampleTokenFactory } from "../types/ethers-contracts/ExampleTokenFactory";
import { DepositManagerFactory } from "../types/ethers-contracts/DepositManagerFactory";
import { RollupFactory } from "../types/ethers-contracts/RollupFactory";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";

import { Signer, Contract } from "ethers";
import { DeploymentParameters } from "./interfaces";
import { allContracts } from "./allContractsInterfaces";
import {
    FrontendGenericFactory,
    FrontendTransferFactory,
    FrontendMassMigrationFactory,
    FrontendCreate2TransferFactory,
    SpokeRegistryFactory,
    VaultFactory,
    WithdrawManagerFactory,
    Create2TransferFactory
} from "../types/ethers-contracts";
import { BurnAuctionFactory } from "../types/ethers-contracts/BurnAuctionFactory";
import { BurnAuction } from "../types/ethers-contracts/BurnAuction";
import { ProofOfBurnFactory } from "../types/ethers-contracts/ProofOfBurnFactory";
import { ProofOfBurn } from "../types/ethers-contracts/ProofOfBurn";
import { GenesisNotSpecified } from "./exceptions";

async function waitAndRegister(
    contract: Contract,
    name: string,
    verbose: boolean
) {
    await contract.deployed();
    if (verbose) console.log("Deployed", name, "at", contract.address);
}

export async function deployAll(
    signer: Signer,
    parameters: DeploymentParameters,
    verbose: boolean = false
): Promise<allContracts> {
    // deploy libs
    const frontendGeneric = await new FrontendGenericFactory(signer).deploy();
    await waitAndRegister(frontendGeneric, "frontendGeneric", verbose);

    const frontendTransfer = await new FrontendTransferFactory(signer).deploy();
    await waitAndRegister(frontendTransfer, "frontendTransfer", verbose);

    const frontendMassMigration = await new FrontendMassMigrationFactory(
        signer
    ).deploy();
    await waitAndRegister(
        frontendMassMigration,
        "frontendMassMigration",
        verbose
    );

    const frontendCreate2Transfer = await new FrontendCreate2TransferFactory(
        signer
    ).deploy();
    await waitAndRegister(
        frontendCreate2Transfer,
        "frontendCreate2Transfer",
        verbose
    );
    // deploy a chooser
    let chooser: ProofOfBurn | BurnAuction;
    if (parameters.USE_BURN_AUCTION) {
        chooser = await new BurnAuctionFactory(signer).deploy(
            parameters.DONATION_ADDRESS,
            parameters.DONATION_NUMERATOR
        );
    } else {
        chooser = await new ProofOfBurnFactory(signer).deploy();
    }
    await waitAndRegister(chooser, "chooser", verbose);

    const blsAccountRegistry = await new BlsAccountRegistryFactory(
        signer
    ).deploy();
    await waitAndRegister(blsAccountRegistry, "blsAccountRegistry", verbose);

    // deploy Token registry contract
    const tokenRegistry = await new TokenRegistryFactory(signer).deploy();
    await waitAndRegister(tokenRegistry, "tokenRegistry", verbose);

    const massMigration = await new MassMigrationFactory(signer).deploy();
    await waitAndRegister(massMigration, "mass_migs", verbose);

    const transfer = await new TransferFactory(signer).deploy();
    await waitAndRegister(transfer, "transfer", verbose);

    const create2Transfer = await new Create2TransferFactory(signer).deploy();
    await waitAndRegister(create2Transfer, "create2transfer", verbose);

    // deploy example token
    const exampleToken = await new ExampleTokenFactory(signer).deploy();
    await waitAndRegister(exampleToken, "exampleToken", verbose);
    await tokenRegistry.requestRegistration(exampleToken.address);
    await tokenRegistry.finaliseRegistration(exampleToken.address);

    const spokeRegistry = await new SpokeRegistryFactory(signer).deploy();
    await waitAndRegister(spokeRegistry, "spokeRegistry", verbose);

    const vault = await new VaultFactory(signer).deploy(
        tokenRegistry.address,
        spokeRegistry.address
    );
    await waitAndRegister(vault, "vault", verbose);

    // deploy deposit manager
    const depositManager = await new DepositManagerFactory(signer).deploy(
        tokenRegistry.address,
        vault.address,
        parameters.MAX_DEPOSIT_SUBTREE_DEPTH
    );
    await waitAndRegister(depositManager, "depositManager", verbose);

    if (!parameters.GENESIS_STATE_ROOT) throw new GenesisNotSpecified();

    // deploy Rollup core
    const rollup = await new RollupFactory(signer).deploy(
        chooser.address,
        depositManager.address,
        blsAccountRegistry.address,
        transfer.address,
        massMigration.address,
        create2Transfer.address,
        parameters.GENESIS_STATE_ROOT,
        parameters.STAKE_AMOUNT,
        parameters.BLOCKS_TO_FINALISE,
        parameters.MIN_GAS_LEFT,
        parameters.MAX_TXS_PER_COMMIT
    );
    await waitAndRegister(rollup, "rollup", verbose);

    await vault.setRollupAddress(rollup.address);
    await depositManager.setRollupAddress(rollup.address);

    const withdrawManager = await new WithdrawManagerFactory(signer).deploy(
        tokenRegistry.address,
        vault.address,
        rollup.address
    );
    await waitAndRegister(withdrawManager, "withdrawManager", verbose);
    await spokeRegistry.registerSpoke(withdrawManager.address);

    return {
        frontendGeneric,
        frontendTransfer,
        frontendMassMigration,
        frontendCreate2Transfer,
        blsAccountRegistry,
        tokenRegistry,
        transfer,
        massMigration,
        create2Transfer,
        chooser,
        exampleToken,
        spokeRegistry,
        vault,
        depositManager,
        rollup,
        withdrawManager
    };
}
