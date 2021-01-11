import { BigNumberish, BytesLike, ethers } from "ethers";
import { Rollup } from "../types/ethers-contracts/Rollup";
import { ZERO_BYTES32 } from "./constants";
import { Wei } from "./interfaces";
import { State } from "./state";
import { MigrationTree, StateProvider } from "./stateTree";
import { Tree } from "./tree";
import { serialize, TxMassMigration } from "./tx";
import { sum } from "./utils";

interface CompressedStruct {
    stateRoot: BytesLike;
    bodyRoot: BytesLike;
}
interface SolStruct {
    stateRoot: BytesLike;
    body: any;
}

export interface CommitmentInclusionProof {
    commitment: CompressedStruct;
    path: number;
    witness: string[];
}

interface XCommitmentInclusionProof {
    commitment: SolStruct;
    path: number;
    witness: string[];
}

abstract class Commitment {
    constructor(public stateRoot: BytesLike) {}

    abstract get bodyRoot(): BytesLike;
    public hash(): string {
        return ethers.utils.solidityKeccak256(
            ["bytes32", "bytes32"],
            [this.stateRoot, this.bodyRoot]
        );
    }
    abstract toSolStruct(): SolStruct;
    abstract toBatch(): Batch;
    public toCompressedStruct(): CompressedStruct {
        return {
            stateRoot: this.stateRoot,
            bodyRoot: this.bodyRoot
        };
    }
}

export class BodylessCommitment extends Commitment {
    get bodyRoot() {
        return ZERO_BYTES32;
    }
    public toSolStruct() {
        return { stateRoot: this.stateRoot, body: {} };
    }
    public toBatch(): Batch {
        return new Batch([this]);
    }
}

export function getGenesisProof(
    stateRoot: BytesLike
): CommitmentInclusionProof {
    return new BodylessCommitment(stateRoot).toBatch().proofCompressed(0);
}

export class TransferCommitment extends Commitment {
    public static new(
        stateRoot: BytesLike = ethers.constants.HashZero,
        accountRoot: BytesLike = ethers.constants.HashZero,
        signature: BigNumberish[] = [0, 0],
        feeReceiver: BigNumberish = 0,
        txs: BytesLike = "0x"
    ) {
        return new TransferCommitment(
            stateRoot,
            accountRoot,
            signature,
            feeReceiver,
            txs
        );
    }
    constructor(
        public stateRoot: BytesLike,
        public accountRoot: BytesLike,
        public signature: BigNumberish[],
        public feeReceiver: BigNumberish,
        public txs: BytesLike
    ) {
        super(stateRoot);
    }
    public get bodyRoot() {
        return ethers.utils.solidityKeccak256(
            ["bytes32", "uint256[2]", "uint256", "bytes"],
            [this.accountRoot, this.signature, this.feeReceiver, this.txs]
        );
    }
    public toSolStruct(): SolStruct {
        return {
            stateRoot: this.stateRoot,
            body: {
                accountRoot: this.accountRoot,
                signature: this.signature,
                feeReceiver: this.feeReceiver,
                txs: this.txs
            }
        };
    }
    public toBatch() {
        return new TransferBatch([this]);
    }
}

export class MassMigrationCommitment extends Commitment {
    public static new(
        stateRoot: BytesLike = ethers.constants.HashZero,
        accountRoot: BytesLike = ethers.constants.HashZero,
        signature: BigNumberish[] = [0, 0],
        spokeID: BigNumberish = 0,
        withdrawRoot: BytesLike = ethers.constants.HashZero,
        tokenID: BigNumberish = 0,
        amount: BigNumberish = 0,
        feeReceiver: BigNumberish = 0,
        txs: BytesLike = "0x"
    ) {
        return new MassMigrationCommitment(
            stateRoot,
            accountRoot,
            signature,
            spokeID,
            withdrawRoot,
            tokenID,
            amount,
            feeReceiver,
            txs
        );
    }
    public static fromStateProvider(
        accountRoot: BytesLike,
        txs: TxMassMigration[],
        signature: BigNumberish[],
        feeReceiver: number,
        stateProvider: StateProvider
    ) {
        const states = [];
        for (const tx of txs) {
            const origin = stateProvider.getState(tx.fromIndex).state;
            const destination = State.new(
                origin.pubkeyID,
                origin.tokenID,
                tx.amount,
                0
            );
            states.push(destination);
        }
        const migrationTree = MigrationTree.fromStates(states);
        const commitment = new this(
            stateProvider.root,
            accountRoot,
            signature,
            txs[0].spokeID,
            migrationTree.root,
            states[0].tokenID,
            sum(txs.map(tx => tx.amount)),
            feeReceiver,
            serialize(txs)
        );
        return { commitment, migrationTree };
    }
    constructor(
        public stateRoot: BytesLike,
        public accountRoot: BytesLike,
        public signature: BigNumberish[],
        public spokeID: BigNumberish,
        public withdrawRoot: BytesLike,
        public tokenID: BigNumberish,
        public amount: BigNumberish,
        public feeReceiver: BigNumberish,
        public txs: BytesLike
    ) {
        super(stateRoot);
    }

    public get bodyRoot() {
        return ethers.utils.solidityKeccak256(
            [
                "bytes32",
                "uint256[2]",
                "uint256",
                "bytes32",
                "uint256",
                "uint256",
                "uint256",
                "bytes"
            ],
            [
                this.accountRoot,
                this.signature,
                this.spokeID,
                this.withdrawRoot,
                this.tokenID,
                this.amount,
                this.feeReceiver,
                this.txs
            ]
        );
    }
    public toSolStruct(): SolStruct {
        return {
            stateRoot: this.stateRoot,
            body: {
                accountRoot: this.accountRoot,
                signature: this.signature,
                spokeID: this.spokeID,
                withdrawRoot: this.withdrawRoot,
                tokenID: this.tokenID,
                amount: this.amount,
                feeReceiver: this.feeReceiver,
                txs: this.txs
            }
        };
    }
    public toBatch() {
        return new MassMigrationBatch([this]);
    }
}

export class Create2TransferCommitment extends TransferCommitment {
    public toBatch(): Create2TransferBatch {
        return new Create2TransferBatch([this]);
    }
}

export class Batch {
    private tree: Tree;
    constructor(public readonly commitments: Commitment[]) {
        this.tree = Tree.merklize(commitments.map(c => c.hash()));
    }

    get commitmentRoot(): string {
        return this.tree.root;
    }

    witness(leafInfex: number): string[] {
        return this.tree.witness(leafInfex).nodes;
    }

    proof(leafInfex: number): XCommitmentInclusionProof {
        return {
            commitment: this.commitments[leafInfex].toSolStruct(),
            path: leafInfex,
            witness: this.witness(leafInfex)
        };
    }
    proofCompressed(leafInfex: number): CommitmentInclusionProof {
        return {
            commitment: this.commitments[leafInfex].toCompressedStruct(),
            path: leafInfex,
            witness: this.witness(leafInfex)
        };
    }
}

export class TransferBatch extends Batch {
    constructor(public readonly commitments: TransferCommitment[]) {
        super(commitments);
    }

    async submit(rollup: Rollup, stakingAmount: Wei) {
        return await rollup.submitTransfer(
            this.commitments.map(c => c.stateRoot),
            this.commitments.map(c => c.signature),
            this.commitments.map(c => c.feeReceiver),
            this.commitments.map(c => c.txs),
            { value: stakingAmount }
        );
    }
}

export class MassMigrationBatch extends Batch {
    constructor(public readonly commitments: MassMigrationCommitment[]) {
        super(commitments);
    }
    async submit(rollup: Rollup, stakingAmount: Wei) {
        return await rollup.submitMassMigration(
            this.commitments.map(c => c.stateRoot),
            this.commitments.map(c => c.signature),
            this.commitments.map(c => [
                c.spokeID,
                c.tokenID,
                c.amount,
                c.feeReceiver
            ]),
            this.commitments.map(c => c.withdrawRoot),
            this.commitments.map(c => c.txs),
            { value: stakingAmount }
        );
    }
}

export class Create2TransferBatch extends Batch {
    constructor(public readonly commitments: TransferCommitment[]) {
        super(commitments);
    }

    async submit(rollup: Rollup, stakingAmount: Wei) {
        return await rollup.submitCreate2Transfer(
            this.commitments.map(c => c.stateRoot),
            this.commitments.map(c => c.signature),
            this.commitments.map(c => c.feeReceiver),
            this.commitments.map(c => c.txs),
            { value: stakingAmount }
        );
    }
}
