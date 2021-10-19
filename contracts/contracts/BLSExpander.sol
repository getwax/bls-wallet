//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./VerificationGateway.sol";

/**
@dev Optimisations to reduce calldata of VerificationGateway multiCall
with shared params.
*/
contract BLSExpander is Initializable {
    VerificationGateway verificationGateway;
    function initialize(address gateway) public initializer {
        verificationGateway = VerificationGateway(gateway);
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
    //     VerificationGateway.TxData[] memory txs = new VerificationGateway.TxData[](length);
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
    //     VerificationGateway.TxData[] memory txs = new VerificationGateway.TxData[](length);
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
        // address rewardRecipient,
        bytes32 publicKeyHash,
        uint256 startNonce,
        uint256[2] memory signature,
        IERC20 ,
        uint256[] calldata ,
        address contractAddress,
        bytes4 methodId,
        bytes[] calldata encodedParamSets
    ) external {
        uint256 length = encodedParamSets.length;
        VerificationGateway.TxData[] memory txs = new VerificationGateway.TxData[](length);
        for (uint256 i=0; i<length; i++) {
            txs[i].publicKeyHash = publicKeyHash;
            txs[i].nonce = startNonce+i;
            // txs[i].rewardTokenAddress = rewardTokenAddress;
            // txs[i].rewardTokenAmount = rewardTokenAmounts[i];
            txs[i].ethValue = 0;
            txs[i].contractAddress = contractAddress;
            txs[i].encodedFunction = abi.encodePacked(methodId, encodedParamSets[i]);
        }

        verificationGateway.actionCalls(
            // payable(msg.sender),
            new uint256[4][](txs.length),
            signature,
            txs
        );
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
    //     VerificationGateway.TxData[] memory txs = new VerificationGateway.TxData[](length);
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

}