//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;


//To avoid constructor params having forbidden evm bytecodes on Optimism
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IWallet.sol";


/** Minimal upgradable smart contract wallet.
    Generic calls can only be requested by its trusted gateway.
 */
contract BLSWallet is Initializable, IWallet
{
    uint256 public nonce;
    address public trustedBLSGateway;

    mapping(bytes32 => IWallet.AuthValue) public authorizations;

    function initialize(
        address blsGateway
    ) external initializer {
        nonce = 0;
        trustedBLSGateway = blsGateway;
    }

    receive() external payable {}
    fallback() external payable {}

    /**
    Wallet can migrate to a new gateway, eg additional signature support
     */
    function setTrustedGateway(address blsGateway) public onlyTrustedGateway {
        trustedBLSGateway = blsGateway;
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
            bytes[] memory _results
        ) {
            success = (_results.length > 0); // false when no actions given
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
    Throws if any action does not succeed.
     */
    function _performOperation(
        IWallet.Operation calldata op
    ) public payable onlyThis returns (
        bytes[] memory results
    ) {
        bytes memory result;
        results = new bytes[](op.actions.length);

        IWallet.ActionData calldata a;
        bool success;
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

    event AuthAdded (
        bytes32 id,
        uint256 delay,
        AuthValue value
    );

    event AuthConsumed (
        bytes32 id,
        uint256 delay,
        AuthValue value
    );

    function authorize(
        bytes32 id,
        uint256 delay,
        bytes32 data
    ) public onlyTrusted {
        AuthValue memory value = AuthValue(data, block.timestamp + delay);
        authorizations[keccak256(abi.encode(id, delay))] = value;

        emit AuthAdded(id, delay, value);
    }

    function deauthorize(bytes32 id, uint256 delay) public onlyTrusted {
        delete authorizations[keccak256(abi.encode(id, delay))];
    }

    function consumeAuthorization(
        bytes32 id,
        uint256 delay,
        bytes32 data
    ) public onlyTrusted {
        bytes32 keyHash = keccak256(abi.encode(id, delay));
        AuthValue memory value = authorizations[keyHash];

        require(value.validFrom != 0, "auth not found");
        require(value.data == data, "not authorized");
        require(value.validFrom <= block.timestamp, "not authorized yet");

        delete authorizations[keyHash];

        emit AuthConsumed(id, delay, value);
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

    modifier onlyTrusted() {
        require(
            (
                msg.sender == address(this) ||
                msg.sender == trustedBLSGateway
            ),
            "BLSWallet: only callable from this or trusted gateway"
        );
        _;
    }

    modifier thisNonce(uint256 opNonce) {
        require(opNonce == nonce, "BLSWallet: only callable with current nonce");
        _;
    }
}
