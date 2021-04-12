import { ethers } from "https://cdn.ethers.io/lib/ethers-5.0.esm.min.js";

class Wallet {

  provider: any;
  signer: any;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider();
    this.signer = this.provider.getSigner()
    console.log(this.signer);
  }

}

export default new Wallet();
