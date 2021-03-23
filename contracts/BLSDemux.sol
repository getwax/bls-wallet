//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;
// pragma abicoder v2;
pragma experimental ABIEncoderV2;

// Modified for solidity 0.7.0
import "./lib/BLS.sol"; //from hubble repo
import "./lib/IERC20.sol";

/** @dev TODO (WIP): protect from replay (nonce, chainId).
 */
contract BLSWalletProxy
{
    address admin;
    bytes32 publicKeyHash;

    constructor(bytes32 blsKeyHash) {
        publicKeyHash = blsKeyHash;
        admin = msg.sender;
    }

    function action(
        address contractAddress,
        bytes memory encodedFunction
    ) public onlyAdmin returns (bool success) {
        (success, ) = address(contractAddress).call(encodedFunction);
    }

    //TODO: reset admin (via bls key)

    //TODO: social recovery

    modifier onlyAdmin() {
        require(msg.sender == admin);
        _;
    }
}

contract BLSWalletDemux
{
    bytes32 BLS_DOMAIN = keccak256(abi.encodePacked(uint32(0xfeedbee5)));
    uint256 constant BLS_LEN = 4;
    uint256[BLS_LEN] ZERO_BLS_SIG = [uint256(0), uint256(0), uint256(0), uint256(0)];

    mapping (bytes32 => uint256[BLS_LEN]) blsKeysFromHash;
    mapping (bytes32 => BLSWalletProxy) walletFromHash;

    event WalletCreated(
        address indexed wallet,
        bytes32 indexed publicKeyHash,
        uint256[BLS_LEN] publicKey
    );

    //TODO?
    // event ActionPerformed(
    //     address indexed wallet,
    //     bytes32 indexed publicKeyHash,
    //     address contract
    // );

    function blsCall(
        uint256[2] calldata signature,
        address contractAddress,
        bytes calldata encodedFunction,
        uint256[4] calldata publicKey
    ) external {
        bytes32 publicKeyHash = keccak256(encodedFunction);
        if (address(walletFromHash[publicKeyHash]) == address(0)) {
            blsKeysFromHash[publicKeyHash] = publicKey;
            walletFromHash[publicKeyHash] = new BLSWalletProxy(publicKeyHash);
            emit WalletCreated(
                address(walletFromHash[publicKeyHash]),
                publicKeyHash,
                publicKey
            );
        }
        
        blsCall(
            signature,
            contractAddress,
            encodedFunction,
            publicKeyHash
        );
    }

    function blsCall(
        uint256[2] calldata signature,
        address contractAddress,
        bytes calldata encodedFunction,
        bytes32 publicKeyHash
    ) public {

        (bool checkResult, bool callSuccess) = BLS.verifySingle(
            signature,
            blsKeysFromHash[publicKeyHash],
            messagePoint(
                contractAddress,
                keccak256(encodedFunction)
            )
        );
        require(callSuccess && checkResult, "BLSDemux: sig not verified");

        walletFromHash[publicKeyHash].action(
            contractAddress,
            encodedFunction
        );
    }

    function blsMultiCall(
        uint256[2] memory signature,
        address[] calldata contractAddresses,
        bytes[] calldata encodedFunctions,
        bytes32[] calldata  publicKeyHashes
    ) public {
        uint256 txCount = contractAddresses.length;
        require(encodedFunctions.length == txCount, "BLSDemux: encodedFunction/contracts length mismatch.");
        require(publicKeyHashes.length == txCount, "BLSDemux: publicKeyHash/contracts length mismatch.");
        
        uint256[BLS_LEN][] memory publicKeys = new uint256[BLS_LEN][](txCount);
        uint256[2][] memory messages = new uint256[2][](txCount);
        for (uint256 i = 0; i<txCount; i++) {
            publicKeys[i] = blsKeysFromHash[publicKeyHashes[i]];
            messages[i] = messagePoint(
                contractAddresses[i],
                keccak256(encodedFunctions[i])
            );
        }
        (bool checkResult, bool callSuccess) = BLS.verifyMultiple(signature, publicKeys, messages);
        require(callSuccess && checkResult, "BLSDemux: All sigs not verified");

        for (uint256 i = 0; i<txCount; i++) {
            walletFromHash[publicKeyHashes[i]].action(
                contractAddresses[i],
                encodedFunctions[i]
            );
        }
    }

    function messagePoint(
        address contractAddress,
        bytes32 encodedFunctionHash
    ) internal view returns (uint256[2] memory) {
        return BLS.hashToPoint(
            BLS_DOMAIN,
            abi.encodePacked(
                contractAddress,
                encodedFunctionHash
            )
        );
    }

    function pointsMatch(
        uint256[2] calldata a,
        uint256[2] memory b
    ) internal pure returns (bool result) {
        result = (a[0] == b[0]);
        result = result && (a[1] == b[1]);
    }

}