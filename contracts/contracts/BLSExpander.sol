//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./VerificationGateway.sol";
import "./interfaces/IWallet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
@dev Optimisations to reduce calldata of VerificationGateway multiCall
with shared params.
*/
contract BLSExpander {

    struct AddressBundle {
        uint256[2] signature;
        address[] senderAddresses;
        IWallet.Operation[] operations;
    }

    VerificationGateway verificationGateway;
    mapping(address => uint256[4]) public addressToPublicKey;

    constructor(address gateway) {
        verificationGateway = VerificationGateway(gateway);
    }

    // eg approve and transfers of a token contract
    function blsCallMultiCheckRewardIncrease(
        IERC20 tokenRewardAddress,
        uint256 tokenRewardAmount,
        VerificationGateway.Bundle calldata bundle
        // uint256[4][] calldata publicKeys,
        // uint256[2] memory signature,
        // VerificationGateway.TxSet[] calldata txs
    ) external returns (uint256 balanceIncrease) {
        uint256 balanceBefore = tokenRewardAddress.balanceOf(tx.origin);

        verificationGateway.processBundle(bundle);

        uint256 balanceAfter = tokenRewardAddress.balanceOf(tx.origin);
        balanceIncrease = balanceAfter - balanceBefore;
        require(balanceIncrease >= tokenRewardAmount, "BLSExpander: Insufficient reward");
    }


    // eg approve and transfers of a token contract
    // function blsCallMultiSameContract(
    //     // address rewardAddress,
    //     bytes32[] calldata  publicKeyHashes,
    //     uint256[2] memory signature,
    //     uint256[] calldata tokenRewardAmounts,
    //     address contractAddress,
    //     bytes4[] calldata methodIds,
    //     bytes[] calldata encodedParamSets
    // ) external {
    //     uint256 length = publicKeyHashes.length;
    //     VerificationGateway.TxSet[] memory txs = new VerificationGateway.TxSet[](length);
    //     for (uint256 i=0; i<length; i++) {
    //         txs[i].publicKeyHash = publicKeyHashes[i];
    //         txs[i].tokenRewardAmount = tokenRewardAmounts[i];
    //         txs[i].contractAddress = contractAddress;
    //         txs[i].methodId = methodIds[i];
    //         txs[i].encodedParams = encodedParamSets[i];
    //     }

    //     verificationGateway.blsCallMany(
    //         msg.sender,
    //         signature,
    //         txs
    //     );
    // }

    // eg a set of txs from one account
    // function blsCallMultiSameCaller(
    //     // address rewardAddress,
    //     bytes32 publicKeyHash,
    //     uint256[2] memory signature,
    //     uint256[] calldata tokenRewardAmounts,
    //     address[] calldata contractAddresses,
    //     bytes4[] calldata methodIds,
    //     bytes[] calldata encodedParamSets
    // ) external {
    //     uint256 length = contractAddresses.length;
    //     VerificationGateway.TxSet[] memory txs = new VerificationGateway.TxSet[](length);
    //     for (uint256 i=0; i<length; i++) {
    //         txs[i].publicKeyHash = publicKeyHash;
    //         txs[i].tokenRewardAmount = tokenRewardAmounts[i];
    //         txs[i].contractAddress = contractAddresses[i];
    //         txs[i].methodId = methodIds[i];
    //         txs[i].encodedParams = encodedParamSets[i];
    //     }

    //     verificationGateway.blsCallMany(
    //         msg.sender,
    //         signature,
    //         txs
    //     );
    // }

    // eg airdrop
    function blsCallMultiSameCallerContractFunction(
        uint256[4] calldata publicKey,
        uint256 nonce,
        uint256[2] calldata signature,
        address contractAddress,
        bytes4 methodId,
        bytes[] calldata encodedParamSets
    ) external {
        uint256 length = encodedParamSets.length;

        VerificationGateway.Bundle memory bundle;
        bundle.signature = signature;

        bundle.senderPublicKeys = new uint256[4][](1);
        bundle.senderPublicKeys[0] = publicKey;

        bundle.operations = new IWallet.Operation[](1);
        bundle.operations[0].nonce = nonce;
        bundle.operations[0].actions = new IWallet.ActionData[](length);
        for (uint256 i=0; i<length; i++) {
            bundle.operations[0].actions[i].ethValue = 0;
            bundle.operations[0].actions[i].contractAddress = contractAddress;
            bundle.operations[0].actions[i].encodedFunction = abi.encodePacked(methodId, encodedParamSets[i]);
        }

        verificationGateway.processBundle(bundle);
    }

    // eg identical txs from multiple accounts
    // function blsCallMultiSameContractFunctionParams(
    //     // address rewardAddress,
    //     bytes32[] calldata  publicKeyHashes,
    //     uint256[2] memory signature,
    //     uint256[] calldata tokenRewardAmounts,
    //     address contractAddress,
    //     bytes4 methodId,
    //     bytes calldata encodedParams
    // ) external {
    //     uint256 length = publicKeyHashes.length;
    //     VerificationGateway.TxSet[] memory txs = new VerificationGateway.TxSet[](length);
    //     for (uint256 i=0; i<length; i++) {
    //         txs[i].publicKeyHash = publicKeyHashes[i];
    //         txs[i].tokenRewardAmount = tokenRewardAmounts[i];
    //         txs[i].contractAddress = contractAddress;
    //         txs[i].methodId = methodId;
    //         txs[i].encodedParams = encodedParams;
    //     }

    //     verificationGateway.blsCallMany(
    //         msg.sender,
    //         signature,
    //         txs
    //     );
    // }

    function registerPublicKey(
        address walletAddress,
        uint256[4] calldata publicKey
    ) public {
        addressToPublicKey[address(walletAddress)] = publicKey;
    }

    function registerPublicKeys(
        address[] calldata walletAddresses,
        uint256[4][] calldata publicKeys
    ) external {
        for (uint256 i=0; i<publicKeys.length; i++) {
            registerPublicKey(walletAddresses[i], publicKeys[i]);
        }
    }

    function addressProcessBundle(
        AddressBundle memory addressBundle
    ) external returns (
        bool[] memory successes,
        bytes[][] memory results
    ) {
        // Expand addresses to public keys
        uint256 numPubKeys = addressBundle.senderAddresses.length;
        uint256[4][] memory senderPublicKeys =
            new uint256[4][](numPubKeys);
        for (uint256 i=0; i<numPubKeys; i++) {
            senderPublicKeys[i] = addressToPublicKey[addressBundle.senderAddresses[i]];
        }

        // Use them to re-create bundle
        VerificationGateway.Bundle memory bundle;
        bundle.signature = addressBundle.signature;
        bundle.senderPublicKeys = senderPublicKeys;
        bundle.operations = addressBundle.operations;

        return verificationGateway.processBundle(bundle);
    }
}
