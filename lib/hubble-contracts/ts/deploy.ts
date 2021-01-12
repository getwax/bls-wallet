import { ParamManagerFactory } from "../types/ethers-contracts/ParamManagerFactory";
import { NameRegistryFactory } from "../types/ethers-contracts/NameRegistryFactory";
import { NameRegistry } from "../types/ethers-contracts/NameRegistry";
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
    verbose: boolean,
    nameRegistry?: NameRegistry,
    registryKey?: string
) {
    await contract.deployed();
    if (verbose) console.log("Deployed", name, "at", contract.address);
    if (nameRegistry) {
        if (!registryKey) throw Error(`Need registry key for ${name}`);
        const tx = await nameRegistry.registerName(
            registryKey,
            contract.address
        );
        await tx.wait();
        if (verbose) console.log("Registered", name, "on nameRegistry");
    }
}

export async function deployAll(
    signer: Signer,
    parameters: DeploymentParameters,
    verbose: boolean = false
): Promise<allContracts> {
    // deploy libs

    const paramManager = await new ParamManagerFactory(signer).deploy();
    await waitAndRegister(paramManager, "paramManager", verbose);

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

    // deploy name registry
    const nameRegistry = await new NameRegistryFactory(signer).deploy();
    await waitAndRegister(nameRegistry, "nameRegistry", verbose);

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
    await waitAndRegister(
        chooser,
        "chooser",
        verbose,
        nameRegistry,
        await paramManager.chooser()
    );

    const allLinkRefs = {
        __$b941c30c0f5422d8b714f571f17d94a5fd$__: paramManager.address
    };

    const blsAccountRegistry = await new BlsAccountRegistryFactory(
        signer
    ).deploy();
    await waitAndRegister(
        blsAccountRegistry,
        "blsAccountRegistry",
        verbose,
        nameRegistry,
        await paramManager.accountRegistry()
    );

    // deploy Token registry contract
    const tokenRegistry = await new TokenRegistryFactory(signer).deploy();
    await waitAndRegister(
        tokenRegistry,
        "tokenRegistry",
        verbose,
        nameRegistry,
        await paramManager.tokenRegistry()
    );

    const massMigration = await new MassMigrationFactory(signer).deploy();
    await waitAndRegister(
        massMigration,
        "mass_migs",
        verbose,
        nameRegistry,
        await paramManager.massMigration()
    );

    const transfer = await new TransferFactory(signer).deploy();
    await waitAndRegister(
        transfer,
        "transfer",
        verbose,
        nameRegistry,
        await paramManager.transferSimple()
    );

    const create2Transfer = await new Create2TransferFactory(signer).deploy();
    await waitAndRegister(
        create2Transfer,
        "create2transfer",
        verbose,
        nameRegistry,
        await paramManager.create2Transfer()
    );

    // deploy example token
    const exampleToken = await new ExampleTokenFactory(signer).deploy();
    await waitAndRegister(
        exampleToken,
        "exampleToken",
        verbose,
        nameRegistry,
        await paramManager.exampleToken()
    );
    await tokenRegistry.requestRegistration(exampleToken.address);
    await tokenRegistry.finaliseRegistration(exampleToken.address);

    const spokeRegistry = await new SpokeRegistryFactory(signer).deploy();
    await waitAndRegister(
        spokeRegistry,
        "spokeRegistry",
        verbose,
        nameRegistry,
        await paramManager.spokeRegistry()
    );

    const vault = await new VaultFactory(allLinkRefs, signer).deploy(
        nameRegistry.address
    );
    await waitAndRegister(
        vault,
        "vault",
        verbose,
        nameRegistry,
        await paramManager.vault()
    );

    // deploy deposit manager
    const depositManager = await new DepositManagerFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address, parameters.MAX_DEPOSIT_SUBTREE_DEPTH);
    await waitAndRegister(
        depositManager,
        "depositManager",
        verbose,
        nameRegistry,
        await paramManager.depositManager()
    );

    if (!parameters.GENESIS_STATE_ROOT) throw new GenesisNotSpecified();

    // deploy Rollup core
    const rollup = await new RollupFactory(allLinkRefs, signer).deploy(
        nameRegistry.address,
        parameters.GENESIS_STATE_ROOT,
        parameters.STAKE_AMOUNT,
        parameters.BLOCKS_TO_FINALISE,
        parameters.MIN_GAS_LEFT,
        parameters.MAX_TXS_PER_COMMIT
    );
    await waitAndRegister(
        rollup,
        "rollup",
        verbose,
        nameRegistry,
        await paramManager.rollupCore()
    );

    await vault.setRollupAddress();

    const withdrawManager = await new WithdrawManagerFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await waitAndRegister(
        withdrawManager,
        "withdrawManager",
        verbose,
        nameRegistry,
        await paramManager.withdrawManager()
    );
    await spokeRegistry.registerSpoke(withdrawManager.address);

    return {
        paramManager,
        frontendGeneric,
        frontendTransfer,
        frontendMassMigration,
        frontendCreate2Transfer,
        nameRegistry,
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
