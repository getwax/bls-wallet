import { BigNumber } from "ethers";
import { randomNum } from "./utils";
import { DecimalCodec, USDT } from "./decimal";
import { MismatchByteLength } from "./exceptions";
import { hexZeroPad, concat, hexlify, solidityPack } from "ethers/lib/utils";
import { COMMIT_SIZE } from "./constants";

const amountLen = 2;
const feeLen = 2;
const stateIDLen = 4;
const nonceLen = 4;
const spokeLen = 4;

export interface Tx {
    encode(prefix?: boolean): string;
    encodeOffchain(): string;
}

export interface SignableTx extends Tx {
    message(): string;
}

export interface OffchainTransfer {
    txType: string;
    fromIndex: number;
    toIndex: number;
    amount: BigNumber;
    fee: BigNumber;
    nonce: number;
}

export interface OffchainMassMigration {
    txType: string;
    fromIndex: number;
    amount: BigNumber;
    fee: BigNumber;
    spokeID: number;
    nonce: number;
}

export interface OffchainCreate2Transfer {
    txType: string;
    fromIndex: number;
    toIndex: number;
    toPubkeyID: number;
    amount: BigNumber;
    fee: BigNumber;
    nonce: number;
}

export function serialize(txs: Tx[]): string {
    return hexlify(concat(txs.map(tx => tx.encode())));
}

function checkByteLength(
    decimal: DecimalCodec,
    fieldName: string,
    expected: number
) {
    if (decimal.bytesLength != expected) {
        throw new MismatchByteLength(
            `Deciaml: ${decimal.bytesLength} bytes, ${fieldName}: ${expected} bytes`
        );
    }
}

export class TxTransfer implements SignableTx {
    private readonly TX_TYPE = "0x01";
    public static rand(): TxTransfer {
        const sender = randomNum(stateIDLen);
        const receiver = randomNum(stateIDLen);
        const amount = USDT.randInt();
        const fee = USDT.randInt();
        const nonce = randomNum(nonceLen);
        return new TxTransfer(sender, receiver, amount, fee, nonce, USDT);
    }

    public static buildList(n: number = COMMIT_SIZE): TxTransfer[] {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxTransfer.rand());
        }
        return txs;
    }

    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public readonly amount: BigNumber,
        public readonly fee: BigNumber,
        public nonce: number,
        public readonly decimal: DecimalCodec
    ) {
        checkByteLength(decimal, "amount", amountLen);
        checkByteLength(decimal, "fee", feeLen);
    }

    public message(): string {
        return solidityPack(
            ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.toIndex,
                this.nonce,
                this.amount,
                this.fee
            ]
        );
    }

    public encodeOffchain() {
        return solidityPack(
            ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.toIndex,
                this.amount,
                this.fee,
                this.nonce
            ]
        );
    }

    public offchain(): OffchainTransfer {
        return {
            txType: this.TX_TYPE,
            fromIndex: this.fromIndex,
            toIndex: this.toIndex,
            amount: this.amount,
            fee: this.fee,
            nonce: this.nonce
        };
    }

    public encode(): string {
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), stateIDLen),
            hexZeroPad(hexlify(this.toIndex), stateIDLen),
            this.decimal.encodeInt(this.amount),
            this.decimal.encodeInt(this.fee)
        ]);
        return hexlify(concated);
    }
}

export class TxMassMigration implements SignableTx {
    private readonly TX_TYPE = "0x05";
    public static rand(): TxMassMigration {
        const sender = randomNum(stateIDLen);
        const amount = USDT.randInt();
        const fee = USDT.randInt();
        const nonce = randomNum(nonceLen);
        const spokeID = randomNum(spokeLen);
        return new TxMassMigration(sender, amount, spokeID, fee, nonce, USDT);
    }
    public static buildList(n: number = COMMIT_SIZE): TxMassMigration[] {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxMassMigration.rand());
        }
        return txs;
    }
    constructor(
        public readonly fromIndex: number,
        public readonly amount: BigNumber,
        public readonly spokeID: number,
        public readonly fee: BigNumber,
        public nonce: number,
        public readonly decimal: DecimalCodec
    ) {
        checkByteLength(decimal, "amount", amountLen);
        checkByteLength(decimal, "fee", feeLen);
    }

    public message(): string {
        return solidityPack(
            ["uint8", "uint32", "uint256", "uint256", "uint32", "uint32"],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.amount,
                this.fee,
                this.nonce,
                this.spokeID
            ]
        );
    }

    public encodeOffchain() {
        return solidityPack(
            ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.amount,
                this.fee,
                this.spokeID,
                this.nonce
            ]
        );
    }

    public offchain(): OffchainMassMigration {
        return {
            txType: this.TX_TYPE,
            fromIndex: this.fromIndex,
            amount: this.amount,
            fee: this.fee,
            spokeID: this.spokeID,
            nonce: this.nonce
        };
    }

    public encode(): string {
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), stateIDLen),
            this.decimal.encodeInt(this.amount),
            this.decimal.encodeInt(this.fee)
        ]);
        return hexlify(concated);
    }
}

export class TxCreate2Transfer implements SignableTx {
    private readonly TX_TYPE = "0x03";
    public static rand(): TxCreate2Transfer {
        const sender = randomNum(stateIDLen);
        const receiver = randomNum(stateIDLen);
        const receiverPub: string[] = ["0x00", "0x00", "0x00", "0x00"];
        const toPubkeyID = randomNum(stateIDLen);
        const amount = USDT.randInt();
        const fee = USDT.randInt();
        const nonce = randomNum(nonceLen);
        return new TxCreate2Transfer(
            sender,
            receiver,
            receiverPub,
            toPubkeyID,
            amount,
            fee,
            nonce,
            USDT
        );
    }
    public static buildList(n: number = COMMIT_SIZE): TxCreate2Transfer[] {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxCreate2Transfer.rand());
        }
        return txs;
    }

    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public toPubkey: string[],
        public readonly toPubkeyID: number,
        public readonly amount: BigNumber,
        public readonly fee: BigNumber,
        public nonce: number,
        public readonly decimal: DecimalCodec
    ) {
        checkByteLength(decimal, "amount", amountLen);
        checkByteLength(decimal, "fee", feeLen);
    }

    public message(): string {
        return solidityPack(
            [
                "uint256",
                "uint256",
                "uint256[4]",
                "uint256",
                "uint256",
                "uint256"
            ],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.toPubkey,
                this.nonce,
                this.amount,
                this.fee
            ]
        );
    }

    public encodeOffchain() {
        return solidityPack(
            [
                "uint256",
                "uint256",
                "uint256",
                "uint256",
                "uint256",
                "uint256",
                "uint256"
            ],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.toIndex,
                this.toPubkeyID,
                this.amount,
                this.fee,
                this.nonce
            ]
        );
    }

    public offchain(): OffchainCreate2Transfer {
        return {
            txType: this.TX_TYPE,
            fromIndex: this.fromIndex,
            toIndex: this.toIndex,
            toPubkeyID: this.toPubkeyID,
            amount: this.amount,
            fee: this.fee,
            nonce: this.nonce
        };
    }

    public encode(): string {
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), stateIDLen),
            hexZeroPad(hexlify(this.toIndex), stateIDLen),
            hexZeroPad(hexlify(this.toPubkeyID), stateIDLen),
            this.decimal.encodeInt(this.amount),
            this.decimal.encodeInt(this.fee)
        ]);
        return hexlify(concated);
    }
}
