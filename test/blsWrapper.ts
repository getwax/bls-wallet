//web2
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
//const axios = require('axios').default;

import * as http from 'http';

//web3
import { BigNumber, Signer, Contract } from "ethers";

//bls
import * as mcl from "../server/src/lib/hubble-contracts/ts/mcl";
import { keyPair } from "../server/src/lib/hubble-contracts/ts/mcl";
import { keccak256, arrayify, Interface, Fragment, ParamType } from "ethers/lib/utils";
import { defaultAbiCoder } from "ethers/lib/utils";
import { BlsSigner, aggregate } from '../server/src/lib/hubble-contracts/ts/blsSigner';
import { RequestOptions } from 'https';

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

    // Initialise transaction arrays
    this.messages = [];
    this.pubkeys = [];
    this.signatures = [];
    this.senderIndex = [];
    this.paramSets = [];
  }

  public async initKeyPairs() {
    // prepare library for bls keypair generation
    console.log("Initialising keyParis");
    await mcl.init();
    console.log(this.addresses);
    for (let i=0; i<this.addresses.length; i++) {
      this.keyPairs.push(mcl.newKeyPair());
    }
    console.log(this.keyPairs);
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

  public async postTx(i: number) {
    try {
      let res = await axios.post('http://localhost:3000/tx/add', {
        pubKey: this.pubKeyForIndex(i),
        sender: this.addresses[this.senderIndex[i]],
        messagePoints: this.messages[i],
        signature: this.signatures[i],
        recipient: this.paramSets[i][0],
        amount: this.paramSets[i][1]
      });
      return true;
    }
    catch(error) {
      console.error(error)
    };
    return false;
  }

  public async getCount() {
    try {
      let res: AxiosResponse = await axios.get('http://localhost:3000/tx/count');
      return res.data;
    }
    catch(err) {
      console.log(err);
    };
  }
  
  public async triggerBatchTransfer() {
    try {
      let res: AxiosResponse = await axios.get('http://localhost:3000/tx/send-batch');
      return res.data;
    }
    catch(err) {
      console.log(err);
    };
  }

  public async postAddresses(token, blsWallet) {
    try {
      let res = await axios.post('http://localhost:3000/admin/setAddresses', {
        tokenAddress: token,
        blsWalletAddress: blsWallet
      });
      return true;
    }
    catch(error) {
      console.error(error)
    };
    return false;
  }

  public async resetDb() {
    try {
      await axios.get('http://localhost:3000/admin/resetTxs');
    }
    catch(err) {
      console.log(err);
    };
  }

  public async getRoot() {
    try {
      let res: AxiosResponse = await axios.get('http://localhost:3000/');
      return res.data;
    }
    catch(err) {
      console.log(err);
    };
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