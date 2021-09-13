//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./lib/IERC20.sol";
import "hardhat/console.sol";

interface IVerificationGateway {
    function walletCrossCheck(bytes32 publicKeyHash) external;
}

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

    receive() external payable {}
    fallback() external payable {}

    function sendEther(
        address payable recipient,
        uint256 amount) onlyGateway public payable {
        (bool sent, bytes memory data) = recipient.call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    function payTokenAmount(
        IERC20 token,
        address recipient,
        uint256 amount
    ) public onlyGateway returns (
        bool success
    ) {
        bytes memory transferFn = abi.encodeWithSignature(
            "transfer(address,uint256)",
            recipient,
            amount
        );
        (success, ) = address(token).call(transferFn);
    }

    /**
    @dev The methodID called is `require`d to succeed. This may change in the future.
     */
    function action(
        uint256 ethValue,
        address contractAddress,
        bytes4 methodID,
        bytes memory encodedParams
    ) public onlyGateway returns (bool success) {
        bytes memory encodedFunction = abi.encodePacked(methodID, encodedParams);
        if (ethValue > 0) {
            (success, ) = payable(contractAddress).call{value: ethValue}(encodedFunction);
        }
        else {
            (success, ) = address(contractAddress).call(encodedFunction);
        }
        nonce++;
    }

    //TODO: reset admin (via bls key)

    //TODO: social recovery

    modifier onlyGateway() {
        require(msg.sender == gateway);
        _;
    }
}
