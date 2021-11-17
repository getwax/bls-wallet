//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;


//To avoid constructor params having forbidden evm bytecodes on Optimism
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IWallet.sol";

interface IVerificationGateway {
    function walletCrossCheck(bytes32 publicKeyHash) external;
}

contract BLSWallet is Initializable
{
    uint256 public nonce;

    // Trusted address to action generic calls from the wallet.
    address public gateway;

    uint256[4] public publicKey;

    function initialize(
        address walletGateway
    ) external initializer {
        nonce = 0;
        gateway = walletGateway;
    }

    function latchPublicKey(
        uint256[4] memory blsKey
    ) public onlyGateway {
        for (uint256 i=0; i<4; i++) {
            require(publicKey[i] == 0, "BLSWallet: public key already set");
        }
        publicKey = blsKey;
    }

    receive() external payable {}
    fallback() external payable {}

    /**
    BLS public key format, contract can be upgraded for other types
     */
    function getPublicKey() external view returns (uint256[4] memory) {
        return publicKey;
    }

    /**
    Wallet can migrate to a new gateway, eg additional signature support
     */
    function setGateway(address walletGateway) public onlyGateway {
        gateway = walletGateway;
    }

    /**
    A regular wallet expects the gateway to verify signed 
    transactions with the wallet's public key, and nonce.
     */
    function executeActions(
        IWallet.ActionData[] calldata actions,
        bool atomic
    ) public payable onlyGateway returns (bool[] memory successes, bytes[] memory results) {
        IWallet.ActionData calldata a;
        bool success;
        bytes memory result;
        successes = new bool[](actions.length);
        results = new bytes[](actions.length);
        for (uint256 i=0; i<actions.length; i++) {
            a = actions[i];
            if (a.ethValue > 0) {
                (success, result) = payable(a.contractAddress).call{value: a.ethValue}(a.encodedFunction);
            }
            else {
                (success, result) = address(a.contractAddress).call(a.encodedFunction);
            }
            require(!atomic||success, "BLSWallet: Action failed");
            results[i] = result;
        }
        incrementNonce();
    }

    /**
    Consecutive nonce increment, contract can be upgraded for other types
     */
    function incrementNonce() private {
        nonce++;
    }

    modifier onlyGateway() {
        require(msg.sender == gateway, "BLSWallet: only callable from gateway");
        _;
    }
}
