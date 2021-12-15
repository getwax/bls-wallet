//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0 <0.9.0;
pragma abicoder v2;


//To avoid constructor params having forbidden evm bytecodes on Optimism
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IWallet.sol";


/** Minimal upgradable smart contract wallet.
    Generic calls can only be requested by its trusted gateway.
 */
contract BLSWallet is Initializable, IBLSWallet
{
    uint256 public nonce;

    // BLS variables
    uint256[4] public blsPublicKey;
    address public trustedBLSGateway;
    address pendingBLSGateway;
    uint pendingGatewayTime;

    function initialize(
        address blsGateway
    ) external initializer {
        nonce = 0;
        trustedBLSGateway = blsGateway;
    }

    /** */
    function latchBLSPublicKey(
        uint256[4] memory blsKey
    ) public onlyTrustedGateway {
        for (uint256 i=0; i<4; i++) {
            require(
                blsPublicKey[i] == 0,
                "BLSWallet: public key already set"
            );
        }
        blsPublicKey = blsKey;
    }

    receive() external payable {}
    fallback() external payable {}

    /**
    BLS public key format, contract can be upgraded for other types
     */
    function getBLSPublicKey() external view returns (uint256[4] memory) {
        return blsPublicKey;
    }

    /**
    Wallet can migrate to a new gateway, eg additional signature support
     */
    function setTrustedGateway(address blsGateway) public onlyTrustedGateway {
        pendingBLSGateway = blsGateway;
        pendingGatewayTime = block.timestamp + 604800; // 1 week from now
    }

    /**
    Set results of any pending set operation if their respective timestamp has elapsed.
     */
    function setAnyPending() public {
        if (block.timestamp > pendingGatewayTime) {
            trustedBLSGateway = pendingBLSGateway;
            pendingGatewayTime = 0;
            pendingBLSGateway = address(0);
        }
    }

    /**
    A regular wallet expects the gateway to verify signed 
    transactions with the wallet's public key, and nonce.
     */
    function performOperation(
        IWallet.Operation calldata op
    ) public payable onlyTrustedGateway thisNonce(op.nonce) returns (
        bool success,
        bytes[] memory results
    ) {
        try this._performOperation(op) returns (
            bool _success,
            bytes[] memory _results
        ) {
            success = _success;
            results = _results;
        }
        catch {
            success = false;
        }
        incrementNonce(); // regardless of outcome of operation
    }

    /**
    @dev Restricted to only be called by this contract, but needs to be public
    so that it can be used in the try/catch block.
     */
    function _performOperation(
        IWallet.Operation calldata op
    ) public payable onlyThis returns (
        bool success,
        bytes[] memory results
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
            require(success);
            results[i] = result;
        }
    }

    /**
    Consecutive nonce increment, contract can be upgraded for other types
     */
    function incrementNonce() private {
        nonce++;
    }

    modifier onlyThis() {
        require(msg.sender == address(this), "BLSWallet: only callable from this");
         _;
    }

    modifier onlyTrustedGateway() {
        bool isTrustedGateway =
            (msg.sender == trustedBLSGateway)
        ;
        require(isTrustedGateway, "BLSWallet: only callable from trusted gateway");
         _;
    }

    modifier thisNonce(uint256 opNonce) {
        require(opNonce == nonce, "BLSWallet: only callable with current nonce");
        _;
    }

}
