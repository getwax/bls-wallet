//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;


//To avoid constructor params having forbidden evm bytecodes on Optimism
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IWallet.sol";

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
    function performOperation(
        IWallet.Operation calldata op
    ) public payable onlyGateway thisNonce(op.nonce) returns (
        bool success, bytes[] memory results
    ) {
        bytes memory result;
        results = new bytes[](op.actions.length);

        IWallet.ActionData calldata a;
        for (uint256 i=0; i<op.actions.length; i++) {
            a = op.actions[i];
            if (a.ethValue > 0) {
                (success, result) = payable(a.contractAddress).call{value: a.ethValue}(a.encodedFunction);
            }
            else {
                (success, result) = address(a.contractAddress).call(a.encodedFunction);
            }
            require(success, "BLSWallet: All actions must succeed");
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

    modifier thisNonce(uint256 opNonce) {
        require(opNonce == nonce, "BLSWallet: only callable with current nonce");
        _;
    }

}
