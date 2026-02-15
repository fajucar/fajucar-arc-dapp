// SPDX-License-Identifier: MIT
// =============================================================================
// ArcDEXRouter_FINAL — Remix (Arc Testnet)
// =============================================================================
// Single-hop only (path.length == 2). USDC/EURC swap.
// Factory: 0x0521040935960c6883B9AaBD9927F7889B0790f2
// Pair:    0x1737Aae53007cB782915F1e4a6533Ac1C8E5cc71
// =============================================================================
pragma solidity ^0.8.20;

// -----------------------------------------------------------------------------
// TransferHelper — transferFrom robusto (low-level call) para tokens que não retornam bool
// -----------------------------------------------------------------------------
library TransferHelper {
    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ArcDEX: TRANSFER_FROM_FAILED");
    }
}

interface IArcDEXFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IArcDEXPair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

contract ArcDEXRouter_FINAL {
    address public immutable factory;

    constructor(address _factory) {
        require(_factory != address(0), "ArcDEX: ZERO_FACTORY");
        factory = _factory;
    }

    function supportsPrecompileTokens() external pure returns (bool) {
        return true;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        require(path.length == 2, "ArcDEX: BAD_PATH");
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        (uint256 reserveIn, uint256 reserveOut) = getReserves(path[0], path[1]);
        amounts[1] = getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "ArcDEX: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "ArcDEX: INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * 997;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "ArcDEX: EXPIRED");
        require(path.length == 2, "ArcDEX: BAD_PATH");
        require(to != address(0), "ArcDEX: ZERO_TO");

        (uint256 reserveIn, uint256 reserveOut) = getReserves(path[0], path[1]);
        uint256 amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "ArcDEX: INSUFFICIENT_OUTPUT_AMOUNT");

        address pair = _pair(path[0], path[1]);
        TransferHelper.safeTransferFrom(path[0], msg.sender, pair, amountIn);

        (address token0,) = sortTokens(path[0], path[1]);
        (uint256 amount0Out, uint256 amount1Out) =
            path[0] == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
        IArcDEXPair(pair).swap(amount0Out, amount1Out, to, "");

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }

    function getReserves(address tokenA, address tokenB)
        public
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        (address token0,) = sortTokens(tokenA, tokenB);
        address pair = _pair(tokenA, tokenB);
        (uint256 reserve0, uint256 reserve1) = IArcDEXPair(pair).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    function _pair(address tokenA, address tokenB) internal view returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = IArcDEXFactory(factory).getPair(token0, token1);
        require(pair != address(0), "ArcDEX: PAIR_NOT_EXIST");
    }

    function pairFor(address tokenA, address tokenB) external view returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        return IArcDEXFactory(factory).getPair(token0, token1);
    }

    function sortTokens(address tokenA, address tokenB) public pure returns (address token0, address token1) {
        require(tokenA != tokenB, "ArcDEX: IDENTICAL_ADDRESSES");
        require(tokenA != address(0) && tokenB != address(0), "ArcDEX: ZERO_ADDRESS");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }
}
