//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;
pragma abicoder v2;

import "./lib/IBLS.sol"; // to use a deployed BLS library

import "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@account-abstraction/contracts/bls/BLSHelper.sol";

import "./BLSWallet.sol";

/**
 * The 4337 Aggregator.
 * 
 * Validates aggregate signatures and provides functions useful for off-chain calculations.
 */
contract AggregateSigValidator
{
    /** Domain chosen arbitrarily */
    bytes32 BLS_DOMAIN = keccak256(abi.encodePacked(uint32(0xfeedbee5)));
    uint8 constant BLS_KEY_LEN = 4;

    IBLS public immutable bls;

    /**
     * @param _bls verified bls library contract address
     */
    constructor(IBLS _bls) {
        bls = _bls;
    }

    /** Throw if bundle not valid or signature verification fails */
    function validateSignatures(
        UserOperation[] calldata userOps,
        bytes calldata signature
    ) view external {
        uint256[2][] memory messages = new uint256[2][](userOps.length);
        uint256[BLS_KEY_LEN][] memory senderPublicKeys = new uint256[BLS_KEY_LEN][](userOps.length);

        for (uint256 i = 0; i < userOps.length; i++) {
            messages[i] = bls.hashToPoint(
                BLS_DOMAIN,
                abi.encodePacked(getRequestId(userOps[i]))
            );

            senderPublicKeys[i] = BLSWallet(payable(userOps[i].sender)).getBlsKey();
        }

        bool verified = bls.verifyMultiple(
            abi.decode(signature, (uint256[2])),
            senderPublicKeys,
            messages
        );

        require(verified, "VG: Sig not verified");
    }

    // TODO
    // function validateUserOpSignature(
    //     UserOperation4337 calldata userOp,
    //     bool offChainSigCheck
    // ) external view returns (
    //     bytes memory sigForUserOp,
    //     bytes memory sigForAggregation,
    //     bytes memory offChainSigInfo
    // ) {}

    //copied from BLS.sol
    uint256 public constant N = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    function aggregateSignatures(
        bytes[] calldata signatures
    ) external pure returns (bytes memory aggregateSignature) {
        BLSHelper.XY[] memory points = new BLSHelper.XY[](signatures.length);
        for (uint i = 0; i < points.length; i++) {
            (uint x, uint y) = abi.decode(signatures[i], (uint, uint));
            points[i] = BLSHelper.XY(x, y);
        }
        BLSHelper.XY memory sum = BLSHelper.sum(points, N);
        return abi.encode(sum.x, sum.y);
    }

    /**
     * get a hash of userOp
     * NOTE: this hash is not the same as UserOperation.hash()
     *  (slightly less efficient, since it uses memory userOp)
     */
    function getUserOpHash(UserOperation memory userOp) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            userOp.sender,
            userOp.nonce,
            keccak256(userOp.initCode),
            keccak256(userOp.callData),
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            keccak256(userOp.paymasterAndData)
        ));
    }

    /**
     * return the BLS "message" for the given UserOp.
     * the wallet should sign this value using its public-key
     */
    function userOpToMessage(UserOperation memory userOp) public view returns (uint256[2] memory) {
        bytes32 hashPublicKey = _getUserOpPubkeyHash(userOp);
        return _userOpToMessage(userOp, hashPublicKey);
    }

    function _userOpToMessage(UserOperation memory userOp, bytes32 publicKeyHash) internal view returns (uint256[2] memory) {
        bytes32 requestId = _getRequestId(userOp, publicKeyHash);
        return bls.hashToPoint(BLS_DOMAIN, abi.encodePacked(requestId));
    }

    //return the public-key hash of a userOp.
    // if its a constructor UserOp, then return constructor hash.
    function _getUserOpPubkeyHash(UserOperation memory userOp) internal view returns (bytes32 hashPublicKey) {
        if (userOp.initCode.length == 0) {
            uint256[4] memory publicKey = BLSWallet(payable(userOp.sender)).getBlsKey();
            hashPublicKey = keccak256(abi.encode(publicKey));
        } else {
            hashPublicKey = keccak256(userOp.initCode);
        }
    }

    function getRequestId(UserOperation memory userOp) public view returns (bytes32) {
        bytes32 hashPublicKey = _getUserOpPubkeyHash(userOp);
        return _getRequestId(userOp, hashPublicKey);
    }

    function _getRequestId(UserOperation memory userOp, bytes32 hashPublicKey) internal view returns (bytes32) {
        return keccak256(abi.encode(getUserOpHash(userOp), hashPublicKey, address(this), block.chainid));
    }
}