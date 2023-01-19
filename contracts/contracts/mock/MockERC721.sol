// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    constructor(string memory name, string memory symbol)
        ERC721(name, symbol)
    {}

    function safeMint(address _to, uint256 _tokenId) public {
        _safeMint(_to, _tokenId);
    }

    function mint(address _to, uint256 _tokenId) public {
        _mint(_to, _tokenId);
    }
}
