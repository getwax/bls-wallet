import { BigNumber, ethers, Signer } from "ethers";
import {
  AddressRegistry__factory as AddressRegistryFactory,
  BLSPublicKeyRegistry__factory as BLSPublicKeyRegistryFactory,
  ERC20Expander,
  ERC20Expander__factory as ERC20ExpanderFactory,
  AggregatorUtilities,
  AggregatorUtilities__factory as AggregatorUtilitiesFactory,
} from "../typechain-types";
import AddressRegistryWrapper from "./AddressRegistryWrapper";
import BlsPublicKeyRegistryWrapper from "./BlsPublicKeyRegistryWrapper";
import {
  encodeBitStream,
  encodePseudoFloat,
  encodeRegIndex,
  encodeVLQ,
  hexJoin,
} from "./encodeUtils";
import SignerOrProvider from "./helpers/SignerOrProvider";
import IOperationCompressor from "./IOperationCompressor";
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from "./SafeSingletonFactory";
import { ActionData, Operation, PublicKey } from "./signer/types";

export default class Erc20Compressor implements IOperationCompressor {
  private constructor(
    public erc20Expander: ERC20Expander,
    public blsPublicKeyRegistry: BlsPublicKeyRegistryWrapper,
    public addressRegistry: AddressRegistryWrapper,
    public aggregatorUtilities: AggregatorUtilities,
  ) {}

  static async wrap(erc20Expander: ERC20Expander): Promise<Erc20Compressor> {
    const [
      blsPublicKeyRegistryAddress,
      addressRegistryAddress,
      aggregatorUtilitiesAddress,
    ] = await Promise.all([
      erc20Expander.blsPublicKeyRegistry(),
      erc20Expander.addressRegistry(),
      erc20Expander.aggregatorUtilities(),
    ]);

    return new Erc20Compressor(
      erc20Expander,
      new BlsPublicKeyRegistryWrapper(
        BLSPublicKeyRegistryFactory.connect(
          blsPublicKeyRegistryAddress,
          erc20Expander.signer,
        ),
      ),
      new AddressRegistryWrapper(
        AddressRegistryFactory.connect(
          addressRegistryAddress,
          erc20Expander.signer,
        ),
      ),
      AggregatorUtilitiesFactory.connect(
        aggregatorUtilitiesAddress,
        erc20Expander.signer,
      ),
    );
  }

  static async deployNew(signer: Signer): Promise<Erc20Compressor> {
    const blsPublicKeyRegistryFactory = new BLSPublicKeyRegistryFactory(signer);
    const addressRegistryFactory = new AddressRegistryFactory(signer);
    const aggregatorUtilitiesFactory = new AggregatorUtilitiesFactory(signer);

    const [
      blsPublicKeyRegistryContract,
      addressRegistryContract,
      aggregatorUtilitiesContract,
    ] = await Promise.all([
      blsPublicKeyRegistryFactory.deploy(),
      addressRegistryFactory.deploy(),
      aggregatorUtilitiesFactory.deploy(),
    ]);

    const erc20ExpanderFactory = new ERC20ExpanderFactory(signer);

    const erc20ExpanderContract = await erc20ExpanderFactory.deploy(
      blsPublicKeyRegistryContract.address,
      addressRegistryContract.address,
      aggregatorUtilitiesContract.address,
    );

    return new Erc20Compressor(
      erc20ExpanderContract,
      new BlsPublicKeyRegistryWrapper(blsPublicKeyRegistryContract),
      new AddressRegistryWrapper(addressRegistryContract),
      aggregatorUtilitiesContract,
    );
  }

  static async connectOrDeploy(
    signerOrFactory: Signer | SafeSingletonFactory,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<Erc20Compressor> {
    const factory = await SafeSingletonFactory.from(signerOrFactory);

    const [blsPublicKeyRegistry, addressRegistry, aggregatorUtilities] =
      await Promise.all([
        BlsPublicKeyRegistryWrapper.connectOrDeploy(factory, salt),
        AddressRegistryWrapper.connectOrDeploy(factory, salt),
        factory.connectOrDeploy(AggregatorUtilitiesFactory, [], salt),
      ]);

    const erc20ExpanderContract = await factory.connectOrDeploy(
      ERC20ExpanderFactory,
      [
        blsPublicKeyRegistry.registry.address,
        addressRegistry.registry.address,
        aggregatorUtilities.address,
      ],
      salt,
    );

    return new Erc20Compressor(
      erc20ExpanderContract,
      blsPublicKeyRegistry,
      addressRegistry,
      aggregatorUtilities,
    );
  }

  static async connectIfDeployed(
    signerOrProvider: SignerOrProvider,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<Erc20Compressor | undefined> {
    const factoryViewer = await SafeSingletonFactoryViewer.from(
      signerOrProvider,
    );

    const [
      blsPublicKeyRegistryAddress,
      addressRegistryAddress,
      aggregatorUtilitiesAddress,
    ] = await Promise.all([
      factoryViewer.calculateAddress(BLSPublicKeyRegistryFactory, [], salt),
      factoryViewer.calculateAddress(AddressRegistryFactory, [], salt),
      factoryViewer.calculateAddress(AggregatorUtilitiesFactory, [], salt),
    ]);

    const erc20Expander = await factoryViewer.connectIfDeployed(
      ERC20ExpanderFactory,
      [
        blsPublicKeyRegistryAddress,
        addressRegistryAddress,
        aggregatorUtilitiesAddress,
      ],
      salt,
    );

    if (!erc20Expander) {
      return undefined;
    }

    return await Erc20Compressor.wrap(erc20Expander);
  }

  getExpanderAddress(): string {
    return this.erc20Expander.address;
  }

  async compress(blsPublicKey: PublicKey, operation: Operation) {
    const result: string[] = [];

    const resultIndexForRegUsageBitStream = result.length;
    const bitStream: boolean[] = [];
    result.push("0x"); // Placeholder to overwrite

    const blsPublicKeyId = await this.blsPublicKeyRegistry.reverseLookup(
      blsPublicKey,
    );

    if (blsPublicKeyId === undefined) {
      bitStream.push(false);

      result.push(
        ethers.utils.defaultAbiCoder.encode(["uint256[4]"], [blsPublicKey]),
      );
    } else {
      bitStream.push(true);
      result.push(encodeRegIndex(blsPublicKeyId));
    }

    result.push(encodeVLQ(operation.nonce));
    result.push(encodePseudoFloat(operation.gas));

    result.push(encodeVLQ(operation.actions.length));

    const lastAction = operation.actions.at(-1);
    let txOriginPaymentAction: ActionData | undefined;

    let regularActions: ActionData[];

    if (
      lastAction !== undefined &&
      lastAction.contractAddress === this.aggregatorUtilities.address &&
      ethers.utils.hexlify(lastAction.encodedFunction) ===
        this.aggregatorUtilities.interface.encodeFunctionData(
          "sendEthToTxOrigin",
        )
    ) {
      bitStream.push(true);
      txOriginPaymentAction = lastAction;
      regularActions = operation.actions.slice(0, -1);
    } else {
      bitStream.push(false);
      regularActions = operation.actions;
    }

    for (const action of regularActions) {
      const addressId = await this.addressRegistry.reverseLookup(
        action.contractAddress,
      );

      if (addressId === undefined) {
        bitStream.push(false);
        result.push(action.contractAddress);
      } else {
        bitStream.push(true);
        result.push(encodeRegIndex(addressId));
      }

      const success = await this.compressFunctionCall(
        action.encodedFunction,
        result,
        bitStream,
      );

      if (!success) {
        return undefined;
      }
    }

    if (txOriginPaymentAction !== undefined) {
      result.push(encodePseudoFloat(txOriginPaymentAction.ethValue));
    }

    result[resultIndexForRegUsageBitStream] = encodeBitStream(bitStream);

    return hexJoin(result);
  }

  private async compressFunctionCall(
    encodedFunction: ethers.utils.BytesLike,
    result: string[],
    bitStream: boolean[],
  ): Promise<boolean> {
    const encodedFunctionHex = ethers.utils.hexlify(encodedFunction);
    const parametersHex = ethers.utils.hexDataSlice(encodedFunctionHex, 4);

    if (isMethod("transfer(address,uint256)", encodedFunction)) {
      return this.compressTransfer(parametersHex, result, bitStream);
    }

    if (isMethod("transferFrom(address,address,uint256)", encodedFunction)) {
      return this.compressTransferFrom(parametersHex, result, bitStream);
    }

    if (isMethod("approve(address,uint256)", encodedFunction)) {
      return this.compressApprove(parametersHex, result, bitStream);
    }

    if (isMethod("mint(address,uint256)", encodedFunction)) {
      return this.compressMint(parametersHex, result, bitStream);
    }

    return false;
  }

  private async compressTransfer(
    parametersHex: string,
    result: string[],
    bitStream: boolean[],
  ): Promise<boolean> {
    if (ethers.utils.hexDataLength(parametersHex) !== 2 * 32) {
      return false;
    }

    result.push(encodeVLQ(0));

    const [to, value] = ethers.utils.defaultAbiCoder.decode(
      ["address", "uint256"],
      parametersHex,
    ) as [string, BigNumber];

    await this.compressAddress(to, result, bitStream);
    result.push(encodePseudoFloat(value));

    return true;
  }

  private async compressTransferFrom(
    parametersHex: string,
    result: string[],
    bitStream: boolean[],
  ): Promise<boolean> {
    if (ethers.utils.hexDataLength(parametersHex) !== 3 * 32) {
      return false;
    }

    result.push(encodeVLQ(1));

    const [from, to, value] = ethers.utils.defaultAbiCoder.decode(
      ["address", "address", "uint256"],
      parametersHex,
    ) as [string, string, BigNumber];

    await this.compressAddress(from, result, bitStream);
    await this.compressAddress(to, result, bitStream);
    result.push(encodePseudoFloat(value));

    return true;
  }

  private async compressApprove(
    parametersHex: string,
    result: string[],
    bitStream: boolean[],
  ): Promise<boolean> {
    if (ethers.utils.hexDataLength(parametersHex) !== 2 * 32) {
      return false;
    }

    const [spender, value] = ethers.utils.defaultAbiCoder.decode(
      ["address", "uint256"],
      parametersHex,
    ) as [string, BigNumber];

    if (value.eq(ethers.constants.MaxUint256)) {
      result.push(encodeVLQ(3));
      await this.compressAddress(spender, result, bitStream);
    } else {
      result.push(encodeVLQ(2));
      await this.compressAddress(spender, result, bitStream);
      result.push(encodePseudoFloat(value));
    }

    return true;
  }

  private async compressMint(
    parametersHex: string,
    result: string[],
    bitStream: boolean[],
  ): Promise<boolean> {
    if (ethers.utils.hexDataLength(parametersHex) !== 2 * 32) {
      return false;
    }

    result.push(encodeVLQ(4));

    const [to, value] = ethers.utils.defaultAbiCoder.decode(
      ["address", "uint256"],
      parametersHex,
    ) as [string, BigNumber];

    await this.compressAddress(to, result, bitStream);
    result.push(encodePseudoFloat(value));

    return true;
  }

  private async compressAddress(
    address: string,
    result: string[],
    bitStream: boolean[],
  ) {
    const addressId = await this.addressRegistry.reverseLookup(address);

    if (addressId === undefined) {
      bitStream.push(false);
      result.push(address);
    } else {
      bitStream.push(true);
      result.push(encodeRegIndex(addressId));
    }
  }
}

function isMethod(
  signature: string,
  encodedFunction: ethers.utils.BytesLike,
): boolean {
  const methodId = ethers.utils
    .keccak256(ethers.utils.toUtf8Bytes(signature))
    .slice(0, 10);

  return ethers.utils.hexlify(encodedFunction).startsWith(methodId);
}
