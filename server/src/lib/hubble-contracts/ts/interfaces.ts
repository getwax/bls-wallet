export type Wei = string;

export interface DeploymentParameters {
    MAX_DEPTH: number;
    MAX_DEPOSIT_SUBTREE_DEPTH: number;
    STAKE_AMOUNT: Wei;
    BLOCKS_TO_FINALISE: number;
    MIN_GAS_LEFT: number;
    MAX_TXS_PER_COMMIT: number;
    USE_BURN_AUCTION: boolean;
    GENESIS_STATE_ROOT?: string;

    DONATION_ADDRESS: string;
    DONATION_NUMERATOR: number;
}

export enum Usage {
    Genesis,
    Transfer,
    MassMigration
}

export enum Result {
    Ok,
    InvalidTokenAmount,
    NotEnoughTokenBalance,
    BadFromTokenID,
    BadToTokenID,
    BadSignature,
    MismatchedAmount,
    BadWithdrawRoot,
    BadCompression,
    TooManyTx
}
