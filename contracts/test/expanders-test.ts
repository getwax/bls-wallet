import { expect } from "chai";
import { ethers } from "ethers";

import Fixture from "../shared/helpers/Fixture";
import hexLen from "../shared/helpers/hexLen";

describe("Expanders", async function () {
  it("should transfer ETH", async function () {
    const fx = await Fixture.getSingleton();
    const transferAmount = ethers.utils.parseEther("1.0");

    const [sendWallet, recvWallet] = await fx.createBLSWallets(2);

    await receiptOf(
      fx.signers[0].sendTransaction({
        to: sendWallet.address,
        value: transferAmount,
      }),
    );

    expect(fx.provider.getBalance(sendWallet.address)).to.eventually.eq(
      transferAmount,
    );

    const bundle = await sendWallet.signWithGasEstimate({
      nonce: await sendWallet.Nonce(),
      actions: [
        {
          ethValue: transferAmount,
          contractAddress: recvWallet.address,
          encodedFunction: "0x",
        },
      ],
    });

    const compressedBundle = await fx.bundleCompressor.compress(bundle);

    /*
      Example:

      01     - One operation
      00     - Use expander 0 (fallback expander)
      00     - Bit stream with all zeros (all false)
               (tells us not to use registries)

      1d7c587bfcce8e06c0eda8689f65f040332b9215e535cf5fc918c373784c0049
      1331ae05ceb5d4b9c21d9baf0f5a7903c79da0969671f5e93e246ff45325bd27
      1ffb988e63622b55830e43f3598331e41144868af1b1b446e701b5a41c839527
      0cf8e45adf57468e80075c48852dd8e4540718e812385b4e6377a329d471431e
             - sendWallet's public key

      00     - nonce: 0
      0abf55 - gas: 65194
      01     - one action
      9900   - 1 ETH

      05833c9cddCBDBd39DD4694A645cB8203bceb057
             - recvWallet's address

      00     - 0 bytes for encoded function

      2f0f74e40030e307b0914faa3fbb739a47ac3bd50b335703eeb695535c7d8edf
      080b100ffcc1b7e0498d600b6ef799602520c4d82582dc8586b6755ddada9a27
             - signature
    */
    expect(hexLen(compressedBundle)).to.be.lessThan(250);

    await receiptOf(fx.blsExpanderDelegator.run(compressedBundle));

    expect(fx.provider.getBalance(sendWallet.address)).to.eventually.eq(0);

    expect(fx.provider.getBalance(recvWallet.address)).to.eventually.eq(
      transferAmount,
    );
  });
});

async function receiptOf(
  responsePromise: Promise<ethers.providers.TransactionResponse>,
): Promise<ethers.providers.TransactionReceipt> {
  const response = await responsePromise;
  const receipt = await response.wait();

  return receipt;
}
