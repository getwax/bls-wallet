import { ZERO_BYTES32 } from "../constants";
import { minTreeDepth } from "../utils";
import {
    BadMergeAlignment,
    EmptyArray,
    ExceedTreeSize,
    MismatchHash,
    MismatchLength,
    NegativeIndex
} from "../exceptions";
import { Hasher, Node } from "./hasher";

type Level = { [node: number]: Node };
export type Data = string;

export type Witness = {
    path: Array<boolean>;
    nodes: Array<Node>;
    leaf: Node;
    index: number;
    data?: Data;
    depth?: number;
};

export class Tree {
    public readonly zeros: Array<Node>;
    public readonly depth: number;
    public readonly setSize: number;
    public readonly hasher: Hasher;
    private readonly tree: Array<Level> = [];

    public static new(depth: number, hasher?: Hasher): Tree {
        return new Tree(depth, hasher || Hasher.new());
    }

    public static merklize(leaves: Node[]): Tree {
        const depth = minTreeDepth(leaves.length);
        // This ZERO_BYTES32 must match the one we use in the mekle tree utils contract
        const hasher = Hasher.new("bytes", ZERO_BYTES32);
        const tree = Tree.new(depth, hasher);
        tree.updateBatch(0, leaves);
        return tree;
    }

    constructor(depth: number, hasher: Hasher) {
        this.depth = depth;
        this.setSize = 2 ** this.depth;
        this.tree = [];
        for (let i = 0; i < depth + 1; i++) {
            this.tree.push({});
        }
        this.hasher = hasher;
        this.zeros = this.hasher.zeros(depth);
    }

    get root(): Node {
        return this.tree[0][0] || this.zeros[0];
    }

    public getNode(level: number, index: number): Node {
        return this.tree[level][index] || this.zeros[level];
    }

    // witnessForBatch given merging subtree offset and depth constructs a witness
    public witnessForBatch(
        mergeOffsetLower: number,
        subtreeDepth: number
    ): Witness {
        const mergeSize = 1 << subtreeDepth;
        const mergeOffsetUpper = mergeOffsetLower + mergeSize;
        const pathFollower = mergeOffsetLower >> subtreeDepth;
        const subtreeRootIndexUpper = (mergeOffsetUpper - 1) >> subtreeDepth;

        if (pathFollower != subtreeRootIndexUpper)
            throw new BadMergeAlignment(
                `pathFollower ${pathFollower}; subtreeRootIndexUpper ${subtreeRootIndexUpper}`
            );

        return this.witness(pathFollower, this.depth - subtreeDepth);
    }

    // witness given index and depth constructs a witness
    public witness(index: number, depth: number = this.depth): Witness {
        const path = Array<boolean>(depth);
        const nodes = Array<Node>(depth);
        let nodeIndex = index;
        const leaf = this.getNode(depth, nodeIndex);
        for (let i = 0; i < depth; i++) {
            nodeIndex ^= 1;
            nodes[i] = this.getNode(depth - i, nodeIndex);
            path[i] = (nodeIndex & 1) == 1;
            nodeIndex >>= 1;
        }
        return { path, nodes, leaf, index, depth };
    }

    // checkInclusion verifies the given witness.
    // It performs root calculation rather than just looking up for the leaf or node
    public checkInclusion(witness: Witness): boolean {
        // we check the form of witness data rather than looking up for the leaf
        if (witness.nodes.length == 0) throw new EmptyArray();
        if (witness.nodes.length != witness.path.length)
            throw new MismatchLength(
                `nodes: ${witness.nodes.length}; path: ${witness.path.length}`
            );
        const data = witness.data;
        if (data) {
            if (witness.nodes.length != this.depth)
                throw new MismatchLength(
                    `nodes: ${witness.nodes.length}; tree depth: ${this.depth}`
                );
            const dataHash = this.hasher.hash(data);
            if (dataHash != witness.leaf)
                throw new MismatchHash(
                    `hash(data): ${dataHash}; leaf: ${witness.leaf}`
                );
        }
        const depth = witness.depth ? witness.depth : this.depth;

        let leaf = witness.leaf;
        for (let i = 0; i < depth; i++) {
            const node = witness.nodes[i];
            if (witness.path[i]) {
                leaf = this.hasher.hash2(leaf, node);
            } else {
                leaf = this.hasher.hash2(node, leaf);
            }
        }
        return leaf == this.root;
    }
    private checkSetSize(index: number) {
        if (index >= this.setSize)
            throw new ExceedTreeSize(
                `Leaf index ${index}; tree size ${this.setSize}`
            );
        // Probably an overflow if this error is hit
        if (index < 0) throw new NegativeIndex(`${index}`);
    }

    // insertSingle updates tree with a single raw data at given index
    public insertSingle(leafIndex: number, data: Data) {
        this.checkSetSize(leafIndex);
        this.tree[this.depth][leafIndex] = this.hasher.toLeaf(data);
        this.ascend(leafIndex, 1);
    }

    // updateSingle updates tree with a leaf at given index
    public updateSingle(leafIndex: number, leaf: Node) {
        this.checkSetSize(leafIndex);
        this.tree[this.depth][leafIndex] = leaf;
        this.ascend(leafIndex, 1);
    }

    // insertBatch given multiple raw data updates tree ascending from an offset
    public insertBatch(offset: number, data: Array<Data>) {
        const len = data.length;
        if (len == 0) throw new EmptyArray();
        const lastIndex = len + offset - 1;
        this.checkSetSize(lastIndex);
        for (let i = 0; i < len; i++) {
            this.tree[this.depth][offset + i] = this.hasher.toLeaf(data[i]);
        }
        this.ascend(offset, len);
    }

    // updateBatch given multiple sequencial data updates tree ascending from an offset
    public updateBatch(offset: number, leaves: Array<Node>) {
        const len = leaves.length;
        if (len == 0) throw new EmptyArray();
        const lastIndex = len + offset - 1;
        this.checkSetSize(lastIndex);
        for (let i = 0; i < len; i++) {
            this.tree[this.depth][offset + i] = leaves[i];
        }
        this.ascend(offset, len);
    }

    public isZero(level: number, leafIndex: number): boolean {
        return this.zeros[level] == this.getNode(level, leafIndex);
    }

    private ascend(offset: number, len: number) {
        for (let level = this.depth; level > 0; level--) {
            if (offset & 1) {
                offset -= 1;
                len += 1;
            }
            if (len & 1) {
                len += 1;
            }
            for (let node = offset; node < offset + len; node += 2) {
                this.updateCouple(level, node);
            }
            offset >>= 1;
            len >>= 1;
        }
    }

    private updateCouple(level: number, leafIndex: number) {
        const n = this.hashCouple(level, leafIndex);
        this.tree[level - 1][leafIndex >> 1] = n;
    }

    private hashCouple(level: number, leafIndex: number) {
        const X = this.getCouple(level, leafIndex);
        return this.hasher.hash2(X.l, X.r);
    }

    private getCouple(level: number, index: number): { l: Node; r: Node } {
        index = index & ~1;
        return {
            l: this.getNode(level, index),
            r: this.getNode(level, index + 1)
        };
    }
}
