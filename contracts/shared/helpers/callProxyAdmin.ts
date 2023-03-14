import { ethers } from "hardhat";
import Fixture from "./Fixture";
import { BlsWalletWrapper, ActionData, Bundle } from "../../clients/src";
import { ContractReceipt } from "ethers";

export async function proxyAdminCall(
  fx: Fixture,
  wallet: BlsWalletWrapper,
  functionName: string,
  functionParams: any[],
): Promise<ContractReceipt> {
  return await (
    await fx.verificationGateway.processBundle(
      await proxyAdminBundle(fx, wallet, functionName, functionParams),
    )
  ).wait();
}

/** proxyAdmin function data is a parameter to the walletAdminCall
 * function of the Verification Gateway. The encoded admin call is
 * then wrapped in an action, signed into a single operation bundle.
 */
export async function proxyAdminBundle(
  fx: Fixture,
  wallet: BlsWalletWrapper,
  functionName: string,
  functionParams: any[],
): Promise<Bundle> {
  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const encodedGetProxyAdmin = ProxyAdmin.interface.encodeFunctionData(
    functionName,
    functionParams,
  );
  const encodedWalletAdminCall =
    fx.verificationGateway.interface.encodeFunctionData("walletAdminCall", [
      wallet.blsWalletSigner.getPublicKeyHash(),
      encodedGetProxyAdmin,
    ]);
  const action: ActionData = {
    ethValue: ethers.BigNumber.from(0),
    contractAddress: fx.verificationGateway.address,
    encodedFunction: encodedWalletAdminCall,
  };
  const bundle: Bundle = wallet.sign({
    nonce: await wallet.Nonce(),
    actions: [action],
  });
  return bundle;
}
