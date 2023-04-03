//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./AddressRegistry.sol";
import "./BLSPublicKeyRegistry.sol";
import "./AggregatorUtilities.sol";
import "./lib/RegIndex.sol";
import "./lib/VLQ.sol";
import "./lib/PseudoFloat.sol";
import "./interfaces/IExpander.sol";
import "./interfaces/IWallet.sol";

/**
 * An expander that supports ERC20 operations.
 *
 * This is a bit of a first pass, it could be more compact:
 * - Optimize specifically for transfer
 * - Require registries, removing the need for a bit stream
 * - Use a fixed gas value
 * - Use a dedicated ERC20 registry, allowing a single byte for popular
 *   currencies (and 2 bytes for all but the most obscure currencies)
 * - Use a fixed tx.origin reward (or call contract that computes an appropriate
 *   reward)
 *
 * This would get us down to about 11 bytes. (Current example is 20 bytes.)
 *
 * Example:
 *
 * 0f      - 0x0f = 0b1111 bit stream:
 *           - 1: Use registry for BLS key
 *           - 1: Include a tx.origin payment
 *           - 1: Use registry for ERC20 address
 *           - 1: Use registry for recipient address
 * 000000  - Registry index for sendWallet's public key
 * 00      - nonce: 0
 * 0bda28  - gas: 92,483
 * 02      - two actions
 * 000000  - Registry index for ERC20 address
 * 00      - transfer
 * 000002  - Registry index for recipient address
 * 9100    - 0.1 MCK (amount/value)
 * 6d00    - Pay 0.000005 ETH to tx.origin
 */
contract ERC20Expander is IExpander {
    BLSPublicKeyRegistry public blsPublicKeyRegistry;
    AddressRegistry public addressRegistry;
    AggregatorUtilities public aggregatorUtilities;

    constructor(
        BLSPublicKeyRegistry blsPublicKeyRegistryParam,
        AddressRegistry addressRegistryParam,
        AggregatorUtilities aggregatorUtilitiesParam
    ) {
        blsPublicKeyRegistry = blsPublicKeyRegistryParam;
        addressRegistry = addressRegistryParam;
        aggregatorUtilities = aggregatorUtilitiesParam;
    }

    function expand(bytes calldata stream) external view returns (
        uint256[4] memory senderPublicKey,
        IWallet.Operation memory operation,
        uint256 bytesRead
    ) {
        uint256 originalStreamLen = stream.length;
        uint256 decodedValue;
        bool decodedBit;
        uint256 bitStream;

        (bitStream, stream) = VLQ.decode(stream);

        (decodedBit, bitStream) = decodeBit(
            bitStream
        );

        if (decodedBit) {
            (decodedValue, stream) = RegIndex.decode(stream);
            senderPublicKey = blsPublicKeyRegistry.lookup(decodedValue);
        } else {
            senderPublicKey = abi.decode(stream[:128], (uint256[4]));
            stream = stream[128:];
        }

        (decodedValue, stream) = VLQ.decode(stream);
        operation.nonce = decodedValue;

        (decodedValue, stream) = PseudoFloat.decode(stream);
        operation.gas = decodedValue;

        uint256 actionLen;
        (actionLen, stream) = VLQ.decode(stream);
        operation.actions = new IWallet.ActionData[](actionLen);

        // hasTxOriginPayment
        (decodedBit, bitStream) = decodeBit(bitStream);

        if (decodedBit) {
            // We would use a separate variable for this, but the solidity
            // compiler makes it important to minimize local variables.
            actionLen -= 1;
        }

        for (uint256 i = 0; i < actionLen; i++) {
            (
                operation.actions[i].contractAddress,
                stream,
                bitStream
            ) = decodeAddress(
                stream,
                bitStream
            );

            (
                operation.actions[i].encodedFunction,
                stream,
                bitStream
            ) = decodeFunctionCall(
                stream,
                bitStream
            );
        }

        if (actionLen < operation.actions.length) {
            (decodedValue, stream) = PseudoFloat.decode(stream);

            operation.actions[actionLen] = IWallet.ActionData({
                ethValue: decodedValue,
                contractAddress: address(aggregatorUtilities),
                encodedFunction: abi.encodeWithSignature("sendEthToTxOrigin()")
            });
        }

        bytesRead = originalStreamLen - stream.length;
    }

    function decodeBit(uint256 bitStream) internal pure returns (bool, uint256) {
        return ((bitStream & 1) == 1, bitStream >> 1);
    }

    // Following the naming convention this would be called
    // decodeEncodedFunction, but that's pretty confusing.
    function decodeFunctionCall(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        uint256 methodIndex;
        (methodIndex, stream) = VLQ.decode(stream);

        if (methodIndex == 0) {
            return decodeTransfer(stream, bitStream);
        }

        if (methodIndex == 1) {
            return decodeTransferFrom(stream, bitStream);
        }

        if (methodIndex == 2) {
            return decodeApprove(stream, bitStream);
        }

        if (methodIndex == 3) {
            // Not a real method, but uint256Max is common for approve, and is
            // not represented efficiently by PseudoFloat.
            return decodeApproveMax(stream, bitStream);
        }

        if (methodIndex == 4) {
            return decodeMint(stream, bitStream);
        }

        revert("Unrecognized ERC20 method index");
    }

    function decodeTransfer(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address to;
        (to, stream, bitStream) = decodeAddress(stream, bitStream);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeWithSignature("transfer(address,uint256)", to, value),
            stream,
            bitStream
        );
    }
    
    function decodeTransferFrom(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address from;
        (from, stream, bitStream) = decodeAddress(stream, bitStream);

        address to;
        (to, stream, bitStream) = decodeAddress(stream, bitStream);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                from,
                to,
                value
            ),
            stream,
            bitStream
        );
    }
    
    function decodeApprove(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address spender;
        (spender, stream, bitStream) = decodeAddress(stream, bitStream);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeWithSignature(
                "approve(address,uint256)",
                spender,
                value
            ),
            stream,
            bitStream
        );
    }
    
    function decodeApproveMax(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address spender;
        (spender, stream, bitStream) = decodeAddress(stream, bitStream);

        return (
            abi.encodeWithSignature(
                "approve(address,uint256)",
                spender,
                type(uint256).max
            ),
            stream,
            bitStream
        );
    }

    function decodeMint(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address to;
        (to, stream, bitStream) = decodeAddress(stream, bitStream);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeWithSignature("mint(address,uint256)", to, value),
            stream,
            bitStream
        );
    }

    function decodeAddress(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        address,
        bytes calldata,
        uint256
    ) {
        uint256 decodedValue;
        bool decodedBit;

        (decodedBit, bitStream) = decodeBit(bitStream);

        if (decodedBit) {
            (decodedValue, stream) = RegIndex.decode(stream);
            return (addressRegistry.lookup(decodedValue), stream, bitStream);
        }

        return (address(bytes20(stream[:20])), stream[20:], bitStream);
    }
}
