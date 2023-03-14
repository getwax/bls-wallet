import { ethers } from "ethers";

type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

export default SignerOrProvider;
