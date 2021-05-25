//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;
// pragma abicoder v2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/Initializable.sol";

interface IVerificationGateway {
    function walletCrossCheck(bytes32 publicKeyHash) external;
}

/** @dev TODO (WIP): protect from replay (nonce, chainId).
 */
contract BLSWallet is Initializable
{
    address admin;
    bytes32 public publicKeyHash;
    uint256 public nonce;

    function initialize(bytes32 blsKeyHash) public initializer {
        publicKeyHash = blsKeyHash;
        admin = msg.sender;
        nonce = 0;
    }

    function registerGateway(
        address verificationGateway
    ) internal {
        IVerificationGateway(verificationGateway).walletCrossCheck(publicKeyHash);
    }

    /**
    @dev The methodID called is `require`d to succeed.
     */
    function action(
        address contractAddress,
        bytes4 methodID,
        bytes memory encodedParams
    ) public onlyAdmin returns (bool success) {
        bytes memory encodedFunction = abi.encodePacked(methodID, encodedParams);

        (success, ) = address(contractAddress).call(encodedFunction);
        require(success, "BLSWallet: action failed to call encodedFunction");
        nonce++;
    }


    //TODO: reset admin (via bls key)

    //TODO: social recovery

    modifier onlyAdmin() {
        require(msg.sender == admin);
        _;
    }
}
