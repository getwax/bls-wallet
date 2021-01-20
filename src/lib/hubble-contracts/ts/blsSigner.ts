import {
    solG2,
    Domain,
    getPubkey,
    g2ToHex,
    sign,
    g1ToHex,
    aggregateRaw,
    mclG1,
    solG1,
    SecretKey,
    randFr,
    PublicKey
} from "./mcl";

export interface SignatureInterface {
    mcl: mclG1;
    sol: solG1;
}

export interface BlsSignerInterface {
    pubkey: solG2;
    sign(message: string): SignatureInterface;
}

export class NullBlsSinger implements BlsSignerInterface {
    get pubkey(): solG2 {
        throw new Error("NullBlsSinger has no public key");
    }
    sign(message: string): SignatureInterface {
        throw new Error("NullBlsSinger dosen't sign");
    }
}

export const nullBlsSigner = new NullBlsSinger();

export class BlsSigner implements BlsSignerInterface {
    static new(domain: Domain) {
        const secret = randFr();
        return new BlsSigner(domain, secret);
    }
    private _pubkey: PublicKey;
    constructor(public domain: Domain, private secret: SecretKey) {
        this._pubkey = getPubkey(secret);
    }
    get pubkey(): solG2 {
        return g2ToHex(this._pubkey);
    }

    public sign(message: string): SignatureInterface {
        const { signature } = sign(message, this.secret, this.domain);
        const sol = g1ToHex(signature);
        return { mcl: signature, sol };
    }
}

export function aggregate(
    signatures: SignatureInterface[]
): SignatureInterface {
    const aggregated = aggregateRaw(signatures.map(s => s.mcl));
    return { mcl: aggregated, sol: g1ToHex(aggregated) };
}
