//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;
// pragma abicoder v2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./lib/IERC20.sol";
// import "hardhat/console.sol";

interface IVerificationGateway {
    function walletCrossCheck(bytes32 publicKeyHash) external;
}

/** @dev TODO (WIP): protect from replay (nonce, chainId).
 */
contract BLSWallet is Initializable
{
    address public gateway;
    bytes32 public publicKeyHash;
    uint256 public nonce;

    function initialize(bytes32 blsKeyHash) public initializer {
        publicKeyHash = blsKeyHash;
        gateway = msg.sender;
        nonce = 0;
    }

    function payTokenAmount(
        IERC20 token,
        address recipient,
        uint256 amount
    ) public onlyGateway {
        token.transfer(recipient, amount);
    }

    /**
    @dev The methodID called is `require`d to succeed. This may change in the future.
     */
    function action(
        address contractAddress,
        bytes4 methodID,
        bytes memory encodedParams
    ) public onlyGateway returns (bool success) {
        bytes memory encodedFunction = abi.encodePacked(methodID, encodedParams);

        (success, ) = address(contractAddress).call(encodedFunction);
        require(success, "BLSWallet: action failed to call encodedFunction");
        nonce++;
    }

    //TODO: reset admin (via bls key)

    //TODO: social recovery

    modifier onlyGateway() {
        require(msg.sender == gateway);
        _;
    }
}
