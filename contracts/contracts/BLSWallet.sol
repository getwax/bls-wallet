//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;


//To avoid constructor params having forbidden evm bytecodes on Optimism
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

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

    function getPublicKey() external view returns (uint256[4] memory) {
        return publicKey;
    }

    function setGateway(address walletGateway) public onlyGateway {
        gateway = walletGateway;
    }

    /**
    A regular wallet expects the gateway to verify signed 
    transactions with the wallet's public key, and nonce.
     */
    function action(
        uint256 ethValue,
        address contractAddress,
        bytes calldata encodedFunction
    ) public payable onlyGateway returns (bool success) {
        if (ethValue > 0) {
            (success, ) = payable(contractAddress).call{value: ethValue}(encodedFunction);
        }
        else {
            (success, ) = address(contractAddress).call(encodedFunction);
        }
        incrementNonce();
    }

    function incrementNonce() private {
        nonce++;
    }

    modifier onlyGateway() {
        require(msg.sender == gateway, "BLSWallet: only callable from gateway");
        _;
    }
}
