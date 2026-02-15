// SPDX-License-Identifier: MIT
// =============================================================================
// ArcDEXRouter - USE ESTE ARQUIVO NO REMIX (versão com TransferHelper + Factory.getPair)
// =============================================================================
// Cole este arquivo INTEIRO no Remix. Deploy com Factory = endereço da Factory.
// Usa Factory.getPair() sempre (não usa pairFor/CREATE2/INIT_CODE_HASH).
// NÃO use versões antigas sem a library TransferHelper (o swap com USDC vai reverter).
// =============================================================================
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @dev Helper seguro para transferFrom: tokens que retornam vazio (ex. USDC precompile)
 *      são aceitos. Regra: success && (data.length == 0 || abi.decode(data, (bool))).
 */
library TransferHelper {
    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ArcDEX: TRANSFER_FROM_FAILED");
    }
}

interface IArcDEXPair {
    function token0() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

interface IArcDEXFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

contract ArcDEXRouter {
    address public immutable factory;

    function supportsPrecompileTokens() external pure returns (bool) {
        return true;
    }

    constructor(address _factory) {
        require(_factory != address(0), "ArcDEX: ZERO_FACTORY");
        factory = _factory;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "ArcDEX: EXPIRED");
        require(path.length >= 2, "ArcDEX: INVALID_PATH");

        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "ArcDEX: INSUFFICIENT_OUTPUT_AMOUNT");

        address pair0 = _pair(path[0], path[1]);
        TransferHelper.safeTransferFrom(path[0], msg.sender, pair0, amounts[0]);

        _swap(amounts, path, to);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        public
        view
        returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "ArcDEX: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "ArcDEX: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "ArcDEX: INSUFFICIENT_LIQUIDITY");

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) internal {
        for (uint256 i; i < path.length - 1; i++) {
            address input = path[i];
            address output = path[i + 1];
            (address token0,) = sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];

            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));

            address to = i < path.length - 2 ? _pair(output, path[i + 2]) : _to;
            IArcDEXPair(_pair(input, output)).swap(amount0Out, amount1Out, to, "");
        }
    }

    function getReserves(address tokenA, address tokenB)
        public
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        address pair = _pair(tokenA, tokenB);
        address t0 = IArcDEXPair(pair).token0();
        (uint256 reserve0, uint256 reserve1) = IArcDEXPair(pair).getReserves();
        (reserveA, reserveB) = tokenA == t0 ? (reserve0, reserve1) : (reserve1, reserve0);
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

    function sortTokens(address tokenA, address tokenB)
        public
        pure
        returns (address token0, address token1)
    {
        require(tokenA != tokenB, "ArcDEX: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ArcDEX: ZERO_ADDRESS");
    }
}
