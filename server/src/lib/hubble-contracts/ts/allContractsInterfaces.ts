import { TokenRegistry } from "../types/ethers-contracts/TokenRegistry";
import { ProofOfBurn } from "../types/ethers-contracts/ProofOfBurn";
import { Transfer } from "../types/ethers-contracts/Transfer";
import { ExampleToken } from "../types/ethers-contracts/ExampleToken";
import { DepositManager } from "../types/ethers-contracts/DepositManager";
import { Rollup } from "../types/ethers-contracts/Rollup";
import { BlsAccountRegistry } from "../types/ethers-contracts/BlsAccountRegistry";
import { MassMigration } from "../types/ethers-contracts/MassMigration";
import { Vault } from "../types/ethers-contracts/Vault";
import { WithdrawManager } from "../types/ethers-contracts/WithdrawManager";
import { SpokeRegistry } from "../types/ethers-contracts/SpokeRegistry";
import { FrontendGeneric } from "../types/ethers-contracts/FrontendGeneric";
import { FrontendTransfer } from "../types/ethers-contracts/FrontendTransfer";
import { FrontendMassMigration } from "../types/ethers-contracts/FrontendMassMigration";
import { FrontendCreate2Transfer } from "../types/ethers-contracts/FrontendCreate2Transfer";
import { Create2Transfer } from "../types/ethers-contracts/Create2Transfer";
import { BurnAuction } from "../types/ethers-contracts/BurnAuction";

export interface allContracts {
    frontendGeneric: FrontendGeneric;
    frontendTransfer: FrontendTransfer;
    frontendMassMigration: FrontendMassMigration;
    frontendCreate2Transfer: FrontendCreate2Transfer;
    blsAccountRegistry: BlsAccountRegistry;
    tokenRegistry: TokenRegistry;
    transfer: Transfer;
    massMigration: MassMigration;
    create2Transfer: Create2Transfer;
    chooser: ProofOfBurn | BurnAuction;
    exampleToken: ExampleToken;
    spokeRegistry: SpokeRegistry;
    vault: Vault;
    depositManager: DepositManager;
    rollup: Rollup;
    withdrawManager: WithdrawManager;
}
