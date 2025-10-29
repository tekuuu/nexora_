// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Confidential WETH (cWETH)
/// @notice ERC7984 confidential version of WETH for private transactions
/// @dev This is a generic confidential token that can be swapped with WETH via ConfidentialTokenSwapper
contract ConfidentialWETH is ConfidentialFungibleToken, Ownable, SepoliaConfig, ReentrancyGuard {
    // Events
    event ConfidentialMint(address indexed to, uint256 amount);
    event ConfidentialBurn(address indexed from, uint256 amount);

    // WETH contract address on Sepolia
    address public constant WETH_ADDRESS = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;

    constructor(
        address owner,
        string memory name,
        string memory symbol,
        string memory uri
    ) ConfidentialFungibleToken(name, symbol, uri) Ownable(owner) {}

    /// @notice Mint confidential WETH tokens (called by swapper)
    /// @param to The recipient address
    /// @param amount The amount to mint (as uint64)
    function mint(address to, uint64 amount) external {
        // In production, you'd add access control to only allow the swapper
        // For now, we'll allow anyone to mint for testing
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        
        _mint(to, FHE.asEuint64(amount));
        emit ConfidentialMint(to, amount);
    }

    /// @notice Burn confidential WETH tokens (called by swapper)
    /// @param from The address to burn from
    /// @param amount The encrypted amount to burn
    function burnFrom(address from, euint64 amount) external returns (euint64 transferred) {
        // In production, you'd add access control to only allow the swapper
        require(from != address(0), "Invalid address");
        
        transferred = _burn(from, amount);
        
        // Emit event with encrypted amount (amount is already encrypted)
        emit ConfidentialBurn(from, uint256(euint64.unwrap(transferred)));
    }

    /// @notice Get the underlying WETH token address
    /// @return The WETH contract address
    function underlying() external pure returns (address) {
        return WETH_ADDRESS;
    }

    /// @notice Get encrypted balance for a user (for UI)
    /// @param user The user address
    /// @return The encrypted balance
    function getEncryptedBalance(address user) external view returns (euint64) {
        return confidentialBalanceOf(user);
    }

    /// @notice 1:1 conversion rate with WETH
    /// @return The conversion rate (1)
    function rate() external pure returns (uint256) {
        return 1;
    }

}