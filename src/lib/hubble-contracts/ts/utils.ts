import { ethers } from "ethers";
import { BigNumber } from "ethers";
import { randomBytes, hexlify, hexZeroPad, parseEther } from "ethers/lib/utils";
import { Wei } from "./interfaces";
import { ContractTransaction } from "ethers";
// import { assert, expect } from "chai";
// import { Rollup } from "../types/ethers-contracts/Rollup";

export const FIELD_ORDER = BigNumber.from(
    "0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47"
);

export const ZERO = BigNumber.from("0");
export const ONE = BigNumber.from("1");
export const TWO = BigNumber.from("2");

export function randHex(n: number): string {
    return hexlify(randomBytes(n));
}

export function sum(xs: BigNumber[]): BigNumber {
    return xs.reduce((a, b) => a.add(b));
}

export function to32Hex(n: BigNumber): string {
    return hexZeroPad(n.toHexString(), 32);
}

export function hexToUint8Array(h: string): Uint8Array {
    return Uint8Array.from(Buffer.from(h.slice(2), "hex"));
}

export function toWei(ether: string): Wei {
    return parseEther(ether).toString();
}

export function randFs(): BigNumber {
    const r = BigNumber.from(randomBytes(32));
    return r.mod(FIELD_ORDER);
}

export function randomNum(numBytes: number): number {
    const bytes = randomBytes(numBytes);
    return BigNumber.from(bytes).toNumber();
}

export function randomLeaves(num: number): string[] {
    const leaves = [];
    for (let i = 0; i < num; i++) {
        leaves.push(randHex(32));
    }
    return leaves;
}

// Simulate the tree depth of calling contracts/libs/MerkleTree.sol::MerkleTree.merklise
// Make the depth as shallow as possible
// the length 1 is a special case that the formula doesn't work
export function minTreeDepth(leavesLength: number) {
    return leavesLength == 1 ? 1 : Math.ceil(Math.log2(leavesLength));
}

export async function mineBlocks(
    provider: ethers.providers.JsonRpcProvider,
    numOfBlocks: number
) {
    for (let i = 0; i < numOfBlocks; i++) {
        await provider.send("evm_mine", []);
    }
}

// export async function expectRevert(
//     tx: Promise<ContractTransaction>,
//     revertReason: string
// ) {
//     await tx.then(
//         () => {
//             assert.fail(`Expect tx to fail with reason: ${revertReason}`);
//         },
//         error => {
//             expect(error.message).to.have.string(revertReason);
//         }
//     );
// }

// export async function getBatchID(rollup: Rollup): Promise<number> {
//     return Number(await rollup.nextBatchID()) - 1;
// }
