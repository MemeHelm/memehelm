// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/security/ReentrancyGuard.sol";
import {RevenueSplitVault} from "./RevenueSplitVault.sol";

/// @notice Fixed supply, no owner, no transfer tax, no additional mint or upgrade path.
contract MemeHelmToken is ERC20 {
    string public tokenURI;
    constructor(string memory name_, string memory symbol_, string memory uri, uint256 supply, address creator) ERC20(name_, symbol_) {
        tokenURI = uri;
        _mint(creator, supply);
    }
}

/// @notice Independent issuance. Creates no market, liquidity or automatic trading revenue.
contract MemeHelmLaunchFactory is ReentrancyGuard {
    struct LaunchConfig {
        string name;
        string symbol;
        string metadataCID;
        uint256 totalSupply;
        address projectTreasury;
        address auditTreasury;
        uint16 auditBps;
    }
    mapping(address => address) public vaults;
    mapping(address => address) public creators;
    event TokenCreated(address indexed token, address indexed vault, address indexed creator,
        string name, string symbol, uint256 totalSupply, uint256 ts);

    constructor() { require(block.chainid == 46630, "Robinhood Testnet only"); }

    function createToken(LaunchConfig calldata config, bytes32 salt) external payable nonReentrant returns (address token, address vault) {
        require(bytes(config.name).length >= 2 && bytes(config.name).length <= 96, "Invalid token name");
        require(bytes(config.symbol).length >= 2 && bytes(config.symbol).length <= 10, "Invalid symbol");
        require(bytes(config.metadataCID).length >= 21 && bytes(config.metadataCID).length <= 128, "Invalid metadata CID");
        require(config.totalSupply > 0 && config.totalSupply <= 1e33, "Invalid total supply");
        require(msg.value <= 1 ether, "Initial funding exceeds 1 test ETH");
        token = address(new MemeHelmToken{salt: keccak256(abi.encode(msg.sender, salt))}(
            config.name, config.symbol, string.concat("ipfs://", config.metadataCID), config.totalSupply, msg.sender));
        vault = address(new RevenueSplitVault(token, config.projectTreasury, config.auditTreasury, config.auditBps));
        vaults[token] = vault;
        creators[token] = msg.sender;
        if (msg.value != 0) {
            (bool success,) = payable(vault).call{value: msg.value}("");
            require(success, "Initial funding failed");
        }
        emit TokenCreated(token, vault, msg.sender, config.name, config.symbol, config.totalSupply, block.timestamp);
    }

    function predictTokenAddress(address creator, LaunchConfig calldata config, bytes32 salt) external view returns (address) {
        bytes32 codeHash = keccak256(abi.encodePacked(type(MemeHelmToken).creationCode,
            abi.encode(config.name, config.symbol, string.concat("ipfs://", config.metadataCID), config.totalSupply, creator)));
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this),
            keccak256(abi.encode(creator, salt)), codeHash)))));
    }
}
