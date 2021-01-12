import { DeploymentParameters } from "./interfaces";
import { toWei } from "./utils";

export const TESTING_PARAMS: DeploymentParameters = {
    MAX_DEPTH: 8,
    MAX_DEPOSIT_SUBTREE_DEPTH: 1,
    STAKE_AMOUNT: toWei("0.1"),
    BLOCKS_TO_FINALISE: 5,
    MIN_GAS_LEFT: 300000,
    USE_BURN_AUCTION: false,
    MAX_TXS_PER_COMMIT: 32,
    DONATION_ADDRESS: "0x00000000000000000000000000000000000000d0",
    DONATION_NUMERATOR: 7500
};

export const PRODUCTION_PARAMS: DeploymentParameters = {
    MAX_DEPTH: 20,
    MAX_DEPOSIT_SUBTREE_DEPTH: 2,
    STAKE_AMOUNT: toWei("0.1"),
    BLOCKS_TO_FINALISE: 7 * 24 * 60 * 4, // 7 days of blocks
    MIN_GAS_LEFT: 10000,
    MAX_TXS_PER_COMMIT: 32,
    USE_BURN_AUCTION: true,
    DONATION_ADDRESS: "0x00000000000000000000000000000000000000d0",
    DONATION_NUMERATOR: 7500
};

export const COMMIT_SIZE = 32;
export const STATE_TREE_DEPTH = 32;

export const BLOCKS_PER_SLOT = 100;
export const DELTA_BLOCKS_INITIAL_SLOT = 1000;

// ethers.utils.keccak256(ethers.constants.HashZero)
export const ZERO_BYTES32 =
    "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";

export const EMPTY_SIGNATURE = [0, 0];
