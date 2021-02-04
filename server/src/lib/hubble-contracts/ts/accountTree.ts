import { Tree } from "./tree";
import { BlsAccountRegistry } from "../types/ethers-contracts/BlsAccountRegistry";
import { ethers } from "ethers";
import { solG2 } from "./mcl";
import { RegistrationFail, WrongBatchSize } from "./exceptions";

// Tree is 32 level depth, the index is still smaller than Number.MAX_SAFE_INTEGER
export class AccountRegistry {
    treeLeft: Tree;
    treeRight: Tree;
    leftIndex: number = 0;
    rightIndex: number = 0;
    setSize: number;
    batchSize: number;

    public static async new(
        registry: BlsAccountRegistry
    ): Promise<AccountRegistry> {
        const depth = (await registry.DEPTH()).toNumber();
        const batchDepth = (await registry.BATCH_DEPTH()).toNumber();
        return new AccountRegistry(registry, depth, batchDepth);
    }
    constructor(
        public readonly registry: BlsAccountRegistry,
        private readonly depth: number,
        private readonly batchDepth: number
    ) {
        this.treeLeft = Tree.new(depth);
        this.treeRight = Tree.new(depth);
        this.setSize = 2 ** depth;
        this.batchSize = 2 ** batchDepth;
    }

    public async register(pubkey: solG2): Promise<number> {
        const pubkeyID = await this.syncLeftIndex();
        await this.registry.register(pubkey);
        const leaf = this.pubkeyToLeaf(pubkey);
        this.treeLeft.updateSingle(pubkeyID, leaf);
        const exist = await this.checkExistence(pubkeyID, pubkey);
        if (!exist) throw new RegistrationFail(`PubkeyID ${pubkeyID}`);
        await this.syncLeftIndex();
        return pubkeyID;
    }
    public async registerBatch(pubkeys: solG2[]): Promise<number> {
        const length = pubkeys.length;
        if (length != this.batchSize)
            throw new WrongBatchSize(
                `Expect ${this.batchSize} pubkeys, got ${length}`
            );
        const rigthIndex = await this.syncRightIndex();
        await this.registry.registerBatch(pubkeys);
        const leaves = pubkeys.map(key => this.pubkeyToLeaf(key));
        this.treeRight.updateBatch(rigthIndex, leaves);
        const firstPubkeyID = rigthIndex + this.setSize;
        const lastPubkeyID = firstPubkeyID + length - 1;
        const exist = await this.checkExistence(
            lastPubkeyID,
            pubkeys[length - 1]
        );
        if (!exist) throw new RegistrationFail(`LastID ${lastPubkeyID}`);
        await this.syncRightIndex();
        return firstPubkeyID;
    }

    public async checkExistence(
        pubkeyID: number,
        pubkey: solG2
    ): Promise<boolean> {
        // To do merkle check on chain, we only need 31 hashes in the witness
        // The 32 hash is the root of the left or right tree, which account tree will get it for us.
        const _witness = this.witness(pubkeyID).slice(0, 31);
        return await this.registry.exists(pubkeyID, pubkey, _witness);
    }
    private async syncLeftIndex(): Promise<number> {
        this.leftIndex = (await this.registry.leafIndexLeft()).toNumber();
        return this.leftIndex;
    }
    private async syncRightIndex(): Promise<number> {
        this.rightIndex = (await this.registry.leafIndexRight()).toNumber();
        return this.rightIndex;
    }

    public witness(pubkeyID: number): string[] {
        if (pubkeyID < this.treeLeft.setSize) {
            const witness = this.treeLeft.witness(pubkeyID).nodes;
            witness.push(this.treeRight.root);
            return witness;
        } else {
            const rightTreeID = pubkeyID - this.setSize;
            const witness = this.treeRight.witness(rightTreeID).nodes;
            witness.push(this.treeLeft.root);
            return witness;
        }
    }

    public root() {
        const hasher = this.treeLeft.hasher;
        return hasher.hash2(this.treeLeft.root, this.treeRight.root);
    }

    public pubkeyToLeaf(uncompressed: solG2) {
        const leaf = ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256"],
            uncompressed
        );
        return leaf;
    }
}
