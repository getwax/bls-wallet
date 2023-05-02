import { expect } from "chai";
import { ethers } from "ethers";
import { MockERC20Factory, SafeSingletonFactory } from "../clients/src";

import Fixture from "../shared/helpers/Fixture";
import hexLen from "../shared/helpers/hexLen";
import receiptOf from "../shared/helpers/receiptOf";

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

    await expect(fx.provider.getBalance(sendWallet.address)).to.eventually.eq(
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

      01      - One operation
      00      - Use expander 0 (fallback expander)
      00      - Bit stream with all zeros (all false)
                (tells us not to use registries and not to pay tx.origin)

      1d7c587bfcce8e06c0eda8689f65f040332b9215e535cf5fc918c373784c0049
      1331ae05ceb5d4b9c21d9baf0f5a7903c79da0969671f5e93e246ff45325bd27
      1ffb988e63622b55830e43f3598331e41144868af1b1b446e701b5a41c839527
      0cf8e45adf57468e80075c48852dd8e4540718e812385b4e6377a329d471431e
              - sendWallet's public key

      00      - nonce: 0
      0abf55  - gas: 65194
      01      - one action
      9900    - 1 ETH

      05833c9cddCBDBd39DD4694A645cB8203bceb057
              - recvWallet's address

      00      - 0 bytes for encoded function

      2f0f74e40030e307b0914faa3fbb739a47ac3bd50b335703eeb695535c7d8edf
      080b100ffcc1b7e0498d600b6ef799602520c4d82582dc8586b6755ddada9a27
              - signature
    */
    expect(hexLen(compressedBundle)).to.eq(223);

    await receiptOf(fx.blsExpanderDelegator.run(compressedBundle));

    await expect(fx.provider.getBalance(sendWallet.address)).to.eventually.eq(
      0,
    );

    await expect(fx.provider.getBalance(recvWallet.address)).to.eventually.eq(
      transferAmount,
    );
  });

  it("should transfer ETH using registries", async function () {
    const fx = await Fixture.getSingleton();
    const transferAmount = ethers.utils.parseEther("1.0");

    const [sendWallet, recvWallet] = await fx.createBLSWallets(2);

    await receiptOf(
      fx.signers[0].sendTransaction({
        to: sendWallet.address,
        value: transferAmount,
      }),
    );

    await expect(fx.provider.getBalance(sendWallet.address)).to.eventually.eq(
      transferAmount,
    );

    const { blsPublicKeyRegistry, addressRegistry } = fx.fallbackCompressor;

    await Promise.all(
      [sendWallet, recvWallet]
        .map((wallet) => [
          blsPublicKeyRegistry.register(wallet.PublicKey()),
          addressRegistry.register(wallet.address),
        ])
        .flat(),
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

      01      - One operation
      00      - Use expander 0 (fallback expander)
      05      - 0x05 = 0b101 - bit stream:
                - 1: Use registry for sendWallet's public key
                - 0: Don't include a tx.origin payment
                - 1: Use registry for recvWallet's address
      000000  - Registry index for sendWallet's public key
      00      - nonce: 0
      0abf55  - gas: 65194
      01      - one action
      9900    - 1 ETH
      000001  - Registry index for recvWallet's address
      00      - 0 bytes for encoded function

      1fb09f21986aefbf185b155da79b7edf904eeb73138d08ec8f4af8a3ccc5df52
      2f11bf7eb5cadedc849d6315cd24a74a95f94b91278be2ff4b3cffe2f3625122
              - signature
    */
    expect(hexLen(compressedBundle)).to.eq(81);

    await receiptOf(fx.blsExpanderDelegator.run(compressedBundle));

    await expect(fx.provider.getBalance(sendWallet.address)).to.eventually.eq(
      0,
    );

    await expect(fx.provider.getBalance(recvWallet.address)).to.eventually.eq(
      transferAmount,
    );
  });

  it("should transfer ETH using registries and tx.origin payment", async function () {
    const fx = await Fixture.getSingleton();

    const transferAmount = ethers.utils.parseEther("1.0");

    // Ballpark required payment, a bit under USD $0.01 at the time of writing
    const txOriginPaymentAmount = ethers.utils.parseEther("0.000005");

    const [sendWallet, recvWallet] = await fx.createBLSWallets(2);

    await receiptOf(
      fx.signers[0].sendTransaction({
        to: sendWallet.address,
        value: transferAmount.add(txOriginPaymentAmount),
      }),
    );

    await expect(fx.provider.getBalance(sendWallet.address)).to.eventually.eq(
      transferAmount.add(txOriginPaymentAmount),
    );

    const { blsPublicKeyRegistry, addressRegistry } = fx.fallbackCompressor;

    await Promise.all(
      [sendWallet, recvWallet]
        .map((wallet) => [
          blsPublicKeyRegistry.register(wallet.PublicKey()),
          addressRegistry.register(wallet.address),
        ])
        .flat(),
    );

    const bundle = await sendWallet.signWithGasEstimate({
      nonce: await sendWallet.Nonce(),
      actions: [
        {
          ethValue: transferAmount,
          contractAddress: recvWallet.address,
          encodedFunction: "0x",
        },
        {
          ethValue: txOriginPaymentAmount,
          contractAddress: fx.utilities.address,
          encodedFunction:
            fx.utilities.interface.encodeFunctionData("sendEthToTxOrigin"),
        },
      ],
    });

    const compressedBundle = await fx.bundleCompressor.compress(bundle);

    /*
      Example:

      01      - One operation
      00      - Use expander 0 (fallback expander)
      07      - 0x07 = 0b111 bit stream:
                - 1: Use registry for BLS key
                - 1: Include a tx.origin payment
                - 1: Use registry for address
      000000  - Registry index for sendWallet's public key
      00      - nonce: 0
      0bec0b  - gas: 110683
      02      - two actions
      9900    - 1 ETH
      000001  - Registry index for recvWallet's address
      00      - 0 bytes for encoded function
      6d00    - Pay 0.000005 ETH to tx.origin

      1d0848c4b7dad98043414a8ae395c5b2d82fd47f9584b4e5c71bdb18765672fd
      0d4e1be8b50854fc20cf4948f44b9b3440a59e545e4c93d4f3870f7df5acece3
              - signature
    */
    expect(hexLen(compressedBundle)).to.eq(83);
    // Just 2 extra bytes for the tx.origin payment

    await receiptOf(fx.blsExpanderDelegator.run(compressedBundle));

    await expect(fx.provider.getBalance(sendWallet.address)).to.eventually.eq(
      0,
    );

    await expect(fx.provider.getBalance(recvWallet.address)).to.eventually.eq(
      transferAmount,
    );
  });

  it("should register wallet using BLSRegistration expander", async function () {
    const fx = await Fixture.getSingleton();

    const wallet = await fx.createBLSWallet();

    await expect(
      fx.fallbackCompressor.addressRegistry.reverseLookup(wallet.address),
    ).to.eventually.eq(undefined);

    const bundle = await wallet.signWithGasEstimate(
      {
        nonce: await wallet.Nonce(),
        actions: [
          {
            ethValue: 0,
            contractAddress: fx.blsRegistration.address,
            encodedFunction: fx.blsRegistration.interface.encodeFunctionData(
              "register",
              [wallet.PublicKey()],
            ),
          },
        ],
      },
      0.1,
    );

    /*
      Example:

      01        - One operation
      01        - Use expander 1 (BLSRegistration)

      0d69e9cfa163ffb58b31f72acbf21594c658f928a2aa4c255588404190ee1174
      269b211c15311f421f563fa5275979cd41a76cd1fc1ee42cfbc0b846f615715f
      2d89fbd2625c4eb382361e29ac430cc7e273d121525edc1ebce9ebbf4784e7a0
      02267651f3015fb63f1eedb45c63e8482e00b89321260678608542be29ab7417
                - wallet's public key
                  (without this expander, we'd need to include this twice)

      00        - nonce: 0
      0f81db3b  - gas: 224735 (could be rounded up to 225000 to save 2 bytes)
      00        - No tx.origin payment

      253d3a07f2e329270026b45981d96e057334d149da4f0d6b9a364685d516a737
      2175276eb5a574bf295e72b76decff5eee3db560786bf57a9197f45675b8af31
                - signature
    */
    const compressedBundle = await fx.bundleCompressor.compress(bundle);
    expect(hexLen(compressedBundle)).to.eq(200);

    await receiptOf(fx.processCompressedBundleWithExtraGas(compressedBundle));

    await expect(
      fx.fallbackCompressor.addressRegistry.reverseLookup(wallet.address),
    ).to.eventually.be.gte(0);
  });

  it("should register wallet using BLSRegistration expander including tx.origin payment", async function () {
    const fx = await Fixture.getSingleton();

    // Ballpark expected payment - about USD$0.08 at time of writing. Keeping
    // this to 3 significant figures allows it to be encoded in just
    // 2 bytes: 0x6137.
    const txOriginPayment = ethers.utils.parseEther("0.0000441");

    const wallet = await fx.createBLSWallet();

    await receiptOf(
      fx.signers[0].sendTransaction({
        to: wallet.address,
        value: txOriginPayment,
      }),
    );

    await expect(
      fx.fallbackCompressor.addressRegistry.reverseLookup(wallet.address),
    ).to.eventually.eq(undefined);

    const bundle = await wallet.signWithGasEstimate(
      {
        nonce: await wallet.Nonce(),
        actions: [
          {
            ethValue: 0,
            contractAddress: fx.blsRegistration.address,
            encodedFunction: fx.blsRegistration.interface.encodeFunctionData(
              "register",
              [wallet.PublicKey()],
            ),
          },
          {
            ethValue: txOriginPayment,
            contractAddress: fx.utilities.address,
            encodedFunction:
              fx.utilities.interface.encodeFunctionData("sendEthToTxOrigin"),
          },
        ],
      },
      0.1,
    );

    /*
      Example:

      01        - One operation
      01        - Use expander 1 (BLSRegistration)

      22bc47fccdbe6c24750461b31174eab762c80ef962233145ddbaf76fa6ae6a71
      096d2756e4b6138da227448accf0684ec7f2e50f36c9f4b10072fef79ae61672
      128253cba8eb329b24df35b3a5106266496548566802c5cf8123295d941ca1c8
      185c8698db69361dc5ce278bf1ebba677a7a1020ed83e6741caa16a993989d1a
                - wallet's public key

      00        - nonce: 0
      0b828c62  - gas: 275219
      6137      - tx.origin payment: 0.0000441 ETH

      2c7bbcf33acb0da83f14ec713d14efaa33a89c3011d94d8cf9323bbfc02dad7e
      2f65b7eceb0a7ba25da362a8f4d4b37be133015b234126a7b86a146de2d9663c
                - signature
    */
    const compressedBundle = await fx.bundleCompressor.compress(bundle);
    expect(hexLen(compressedBundle)).to.eq(201);

    await receiptOf(fx.processCompressedBundleWithExtraGas(compressedBundle));

    await expect(
      fx.fallbackCompressor.addressRegistry.reverseLookup(wallet.address),
    ).to.eventually.be.gte(0);
  });

  it("should process additional ETH transfers efficiently", async function () {
    const fx = await Fixture.getSingleton();

    const { addressRegistry, blsPublicKeyRegistry } = fx.fallbackCompressor;

    const wallets = await fx.createBLSWallets(3);

    await Promise.all(
      wallets
        .map((wallet) => [
          blsPublicKeyRegistry.register(wallet.PublicKey()),
          addressRegistry.register(wallet.address),
          receiptOf(
            fx.signers[0].sendTransaction({
              to: wallet.address,
              value: ethers.utils.parseEther("1.0"),
            }),
          ),
        ])
        .flat(),
    );

    //           0.1 ETH           0.2 ETH           0.3 ETH
    // wallet[0]   ->    wallet[1]   ->    wallet[2]   ->    wallet[0]

    const bundle0 = await wallets[0].signWithGasEstimate({
      nonce: await wallets[0].Nonce(),
      actions: [
        {
          ethValue: ethers.utils.parseEther("0.1"),
          contractAddress: wallets[1].address,
          encodedFunction: "0x",
        },
      ],
    });

    const bundle1 = await wallets[1].signWithGasEstimate({
      nonce: await wallets[1].Nonce(),
      actions: [
        {
          ethValue: ethers.utils.parseEther("0.2"),
          contractAddress: wallets[2].address,
          encodedFunction: "0x",
        },
      ],
    });

    const bundle2 = await wallets[2].signWithGasEstimate({
      nonce: await wallets[2].Nonce(),
      actions: [
        {
          ethValue: ethers.utils.parseEther("0.3"),
          contractAddress: wallets[0].address,
          encodedFunction: "0x",
        },
      ],
    });

    const compressedBundle0 = await fx.bundleCompressor.compress(bundle0);

    const compressedBundle01 = await fx.bundleCompressor.compress(
      fx.blsWalletSigner.aggregate([bundle0, bundle1]),
    );

    const compressedBundle012 = await fx.bundleCompressor.compress(
      fx.blsWalletSigner.aggregate([bundle0, bundle1, bundle2]),
    );

    const bundle0Bytes = hexLen(compressedBundle0);

    const bytesToAddBundle1 =
      hexLen(compressedBundle01) - hexLen(compressedBundle0);

    const bytesToAddBundle2 =
      hexLen(compressedBundle012) - hexLen(compressedBundle01);

    expect(bundle0Bytes).to.eq(81);
    expect(bytesToAddBundle1).to.eq(16);
    expect(bytesToAddBundle2).to.eq(16);

    /*
      Example:

      03      - Three operations
      
      First operation:

        00      - Use expander 0 (fallback expander)
        03      - 0x03 = 0b11 - bit stream with 2 true bits (tells us to use
                  registries)
        000000  - Registry index for wallet[0]'s public key
        00      - nonce: 0
        0aa720  - gas: 40194
        01      - one action
        9100    - 0.1 ETH
        000001  - Registry index for wallet[1]'s address
        00      - 0 bytes of encoded function

      Second operation:

        00      - Use expander 0 (fallback expander)
        03      - 0x03 = 0b11 - bit stream with 2 true bits (tells us to use
                  registries)
        000001  - Registry index for wallet[1]'s public key
        00      - nonce: 0
        0aa720  - gas: 40194
        01      - one action
        9200    - 0.2 ETH
        000002  - Registry index for wallet[2]'s address
        00      - 0 bytes of encoded function

      Third operation:

        00      - Use expander 0 (fallback expander)
        03      - 0x03 = 0b11 - bit stream with 2 true bits (tells us to use
                  registries)
        000002  - Registry index for wallet[2]'s public key
        00      - nonce: 0
        0aa720  - gas: 40194
        01      - one action
        9300    - 0.3 ETH
        000000  - Registry index for wallet[0]'s address
        00      - 0 bytes of encoded function

      2fe064bfddd1efca5596bbbb62a3ffd910b640f5923462408d04ddbdfaef289f
      13e9fe34f0ec3465d44718cb6f93697dfbb0000a54287b3acaea5594f36b9aa1
              - signature
    */
    await receiptOf(fx.blsExpanderDelegator.run(compressedBundle012));

    await expect(fx.provider.getBalance(wallets[0].address)).to.eventually.eq(
      ethers.utils
        .parseEther("1.0")
        .add(ethers.utils.parseEther("0.3")) // Received
        .sub(ethers.utils.parseEther("0.1")), // Sent
    );
  });

  it("should transfer ERC20 using registries and tx.origin payment", async function () {
    const fx = await Fixture.getSingleton();
    const { addressRegistry, blsPublicKeyRegistry } = fx.fallbackCompressor;
    const [sendWallet, recvWallet] = await fx.createBLSWallets(2);
    const singletonFactory = await SafeSingletonFactory.init(fx.signers[0]);

    // Ballpark required payment, a bit under USD $0.01 at the time of writing
    const txOriginPaymentAmount = ethers.utils.parseEther("0.000005");

    const erc20 = await singletonFactory.connectOrDeploy(MockERC20Factory, [
      "MockToken",
      "MCK",
      0,
    ]);

    await Promise.all([
      addressRegistry.register(erc20.address),
      receiptOf(
        fx.signers[0].sendTransaction({
          to: sendWallet.address,
          value: txOriginPaymentAmount,
        }),
      ),
      ...[sendWallet, recvWallet]
        .map((wallet) => [
          blsPublicKeyRegistry.register(wallet.PublicKey()),
          addressRegistry.register(wallet.address),
          receiptOf(erc20.mint(wallet.address, ethers.utils.parseEther("1.0"))),
        ])
        .flat(),
    ]);

    const bundle = await sendWallet.signWithGasEstimate({
      nonce: await sendWallet.Nonce(),
      actions: [
        {
          ethValue: 0,
          contractAddress: erc20.address,
          encodedFunction: erc20.interface.encodeFunctionData("transfer", [
            recvWallet.address,
            ethers.utils.parseEther("0.1"),
          ]),
        },
        {
          ethValue: txOriginPaymentAmount,
          contractAddress: fx.utilities.address,
          encodedFunction:
            fx.utilities.interface.encodeFunctionData("sendEthToTxOrigin"),
        },
      ],
    });

    /*
      Example:

      01      - One operation
      02      - Use expander 2 (ERC20 expander)
      0f      - 0x0f = 0b1111 bit stream:
                - 1: Use registry for BLS key
                - 1: Include a tx.origin payment
                - 1: Use registry for ERC20 address
                - 1: Use registry for recipient address
      000000  - Registry index for sendWallet's public key
      00      - nonce: 0
      0bda28  - gas: 92,483
      02      - two actions
      000000  - Registry index for ERC20 address
      00      - transfer
      000002  - Registry index for recipient address
      9100    - 0.1 MCK
      6d00    - Pay 0.000005 ETH to tx.origin

      279ef4bad05ee777d6c6c497592676242f51a9150f6b7c0e4ae5b36445c6d248
      0613346680c8f2b9c3a143a378c2e56a770da56b76d9cb0b8eee29a2e2ac87b7
              - signature
    */

    const compressedBundle = await fx.bundleCompressor.compress(bundle);

    await receiptOf(fx.blsExpanderDelegator.run(compressedBundle));

    await expect(erc20.balanceOf(sendWallet.address)).to.eventually.eq(
      ethers.utils.parseEther("0.9"),
    );

    await expect(erc20.balanceOf(recvWallet.address)).to.eventually.eq(
      ethers.utils.parseEther("1.1"),
    );
  });

  it("should approve max ERC20 using registries", async function () {
    const fx = await Fixture.getSingleton();
    const { addressRegistry, blsPublicKeyRegistry } = fx.fallbackCompressor;
    const [sendWallet, recvWallet] = await fx.createBLSWallets(2);
    const singletonFactory = await SafeSingletonFactory.init(fx.signers[0]);

    const erc20 = await singletonFactory.connectOrDeploy(MockERC20Factory, [
      "MockToken",
      "MCK",
      0,
    ]);

    await Promise.all([
      addressRegistry.register(erc20.address),
      ...[sendWallet, recvWallet]
        .map((wallet) => [
          blsPublicKeyRegistry.register(wallet.PublicKey()),
          addressRegistry.register(wallet.address),
        ])
        .flat(),
    ]);

    const bundle = await sendWallet.signWithGasEstimate({
      nonce: await sendWallet.Nonce(),
      actions: [
        {
          ethValue: 0,
          contractAddress: erc20.address,
          encodedFunction: erc20.interface.encodeFunctionData("approve", [
            recvWallet.address,
            ethers.constants.MaxUint256,
          ]),
        },
      ],
    });

    /*
      Example:

      01      - One operation
      02      - Use expander 2 (ERC20 expander)
      0d      - 0x0d = 0b1101 bit stream:
                - 1: Use registry for BLS key
                - 0: Do not include a tx.origin payment
                - 1: Use registry for ERC20 address
                - 1: Use registry for spender address
                (The read order is 'backwards' because the lowest bit is read
                first)
      000000  - Registry index for sendWallet's public key
      00      - nonce: 0
      0bb917  - gas: 58,555
      01      - one action
      000000  - Registry index for ERC20 address
      03      - approve (max)
      000002  - Registry index for spender address

      2bcf9cdda381531edb01b34b913aa361d5f9cb9da95a41d2ff408d41c8514be0
      1d42409bcd8703f8e0c10d528b8aaf6bf51236cee4ea9653a72a8382b1cba655
              - signature
    */

    const compressedBundle = await fx.bundleCompressor.compress(bundle);

    await expect(
      erc20.allowance(sendWallet.address, recvWallet.address),
    ).to.eventually.eq(0);

    await receiptOf(fx.blsExpanderDelegator.run(compressedBundle));

    await expect(
      erc20.allowance(sendWallet.address, recvWallet.address),
    ).to.eventually.eq(ethers.constants.MaxUint256);
  });
});
