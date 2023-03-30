// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract MockTokenSpender {
    function TransferERC20ToSelf(address _token, uint256 _amount) public {
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    }

    function TransferERC721ToSelf(address _token, uint256 _tokenId) public {
        IERC721(_token).transferFrom(msg.sender, address(this), _tokenId);
    }
}
