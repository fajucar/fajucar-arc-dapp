// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20Standard
 * @notice Standard ERC20 interface. All functions required for DEX integration.
 *        Use this interface for token interactions (approve, transferFrom, etc.).
 *        For tokens that do not return bool (e.g. precompile), use TransferHelper
 *        in contracts instead of direct interface calls.
 */
interface IERC20Standard {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}
