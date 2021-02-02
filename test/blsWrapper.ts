//web2
import * as http from 'http';

//web3
import { BigNumber, Signer, Contract } from "ethers";

//bls
import * as mcl from "../server/src/lib/hubble-contracts/ts/mcl";
import { keyPair } from "../server/src/lib/hubble-contracts/ts/mcl";
import { keccak256, arrayify, Interface, Fragment, ParamType } from "ethers/lib/utils";
import { defaultAbiCoder } from "ethers/lib/utils";
import { BlsSigner, aggregate } from '../server/src/lib/hubble-contracts/ts/blsSigner';

/**
 * A class to handle general tx assembly, bls signing, and aggregation optimisations.
 * @dev assumes mcl has been initialised
 */
class BLSWrapper {
  private readonly domain: Uint8Array;
  private readonly functionName: string;
  private readonly addresses: string[];
  private readonly keyPairs: keyPair[];

  // empty ethers interface object to 
  private static readonly interface: Interface = new Interface(
    [Fragment.fromString("function transfer(address,uint)")]
  );

  messages: any[];
  pubkeys: any[];
  signatures: any[];
  senderIndex: number[];
  paramSets: any[][];

  constructor(
    domain: Uint8Array,
    functionName: string,
    addresses: string[]
  ) {
    // Set readonly members
    this.domain = domain;
    this.functionName = functionName;
    this.addresses = addresses;
    this.keyPairs = [];
    for (let i=0; i<addresses.length; i++) {
      this.keyPairs.push(mcl.newKeyPair());
    }

    // Initialise transaction arrays
    this.messages = [];
    this.pubkeys = [];
    this.signatures = [];
    this.senderIndex = [];
    this.paramSets = [];
  }

  public pubKeyForIndex(i: number): mcl.solG2 {
    return mcl.g2ToHex(this.keyPairs[i].pubkey);
  }
  public messageForParams(params: any[]): string {
    return keccak256(
      BLSWrapper.interface.encodeFunctionData(
        this.functionName, params
      )
    );
  }

  /**
   * Sign the smart contract function+params with key specified by index.
   * @dev Stores all data required to pass to bls wallet for verification.
   * @param fnName smart contract function name
   * @param params parameters for the smart contract function call
   * @param signerIndex bls key to sign with
   */
  public addTx(
    params: any[],
    signerIndex: number
  ) {
    const { signature, messagePoint } = mcl.sign(
      this.messageForParams(params),
      this.keyPairs[signerIndex].secret,
      this.domain
    );

    this.messages.push(mcl.g1ToHex(messagePoint));
    this.pubkeys.push(this.pubKeyForIndex(signerIndex));
    this.signatures.push(signature);
    this.senderIndex.push(signerIndex);
    this.paramSets.push(params);
  }

  public postTx(i: number) {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/addTx',
      method: 'POST'
    }

  }

  public getRoot() {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    }
  
    const req = http.request(options, res => {
      console.log(`statusCode: ${res.statusCode}`);
      res.on('data', d => {
        process.stdout.write(d + '\n');
      })
    })
      
    req.on('error', error => {
      console.error(error);
    })
  
    req.end();

  }

  /**
   * @dev Clear stored transaction data
   */
  public resetTransactions() {
    this.messages.length = 0;
    this.pubkeys.length = 0;
    this.signatures.length = 0;
    this.senderIndex.length = 0;
    this.paramSets.length = 0;
  }

}

export default BLSWrapper;