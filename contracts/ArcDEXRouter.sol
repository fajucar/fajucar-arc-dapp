// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IArcDEXFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IArcDEXPair {
    function token0() external view returns (address);
    // Pair Arc Testnet retorna 2 valores (não blockTimestampLast)
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

contract ArcDEXRouter {
    address public immutable factory;

    error Expired();
    error PairNotFound();
    error InsufficientOutput();
    error InvalidPath();

    constructor(address _factory) {
        require(_factory != address(0), "FACTORY_ZERO");
        factory = _factory;
    }

    /** @dev Indica suporte a tokens precompile (ex.: USDC na Arc). O frontend usa isso para detectar a versão correta. */
    function supportsPrecompileTokens() external pure returns (bool) {
        return true;
    }

    // ---------- low level ERC20 helpers (robustos) ----------

    function _ok(bytes memory data) private pure returns (bool) {
        if (data.length == 0) return true;
        if (data.length == 1) return uint8(data[0]) != 0;
        if (data.length >= 32) {
            uint256 word;
            assembly { word := mload(add(data, 32)) }
            return word != 0;
        }
        for (uint256 i = 0; i < data.length; i++) if (data[i] != 0) return true;
        return false;
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(0x23b872dd, from, to, value)); // transferFrom
        require(ok && _ok(data), "TRANSFER_FROM_FAILED");
    }

    // ---------- pair helpers ----------

    function _pair(address tokenA, address tokenB) internal view returns (address pair) {
        pair = IArcDEXFactory(factory).getPair(tokenA, tokenB);
    }

    function _getReservesOrdered(address pair, address tokenA)
        internal
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        address t0 = IArcDEXPair(pair).token0();
        (uint112 r0, uint112 r1) = IArcDEXPair(pair).getReserves();
        if (tokenA == t0) {
            reserveA = uint256(r0);
            reserveB = uint256(r1);
        } else {
            reserveA = uint256(r1);
            reserveB = uint256(r0);
        }
    }

    function getReserves(address tokenA, address tokenB)
        public
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        address p = _pair(tokenA, tokenB);
        if (p == address(0)) return (0, 0);
        return _getReservesOrdered(p, tokenA);
    }

    // ---------- math ----------
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "INSUFFICIENT_INPUT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQ");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        if (path.length < 2) revert InvalidPath();
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            address tokenIn = path[i];
            address tokenOut = path[i + 1];
            address pair = _pair(tokenIn, tokenOut);
            if (pair == address(0)) revert PairNotFound();

            (uint256 reserveIn, uint256 reserveOut) = _getReservesOrdered(pair, tokenIn);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        if (block.timestamp > deadline) revert Expired();
        if (path.length < 2) revert InvalidPath();
        require(to != address(0), "TO_ZERO");

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            address tokenIn = path[i];
            address tokenOut = path[i + 1];
            address pair = _pair(tokenIn, tokenOut);
            if (pair == address(0)) revert PairNotFound();

            (uint256 reserveIn, uint256 reserveOut) = _getReservesOrdered(pair, tokenIn);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }

        if (amounts[amounts.length - 1] < amountOutMin) revert InsufficientOutput();

        address firstPair = _pair(path[0], path[1]);
        _safeTransferFrom(path[0], msg.sender, firstPair, amounts[0]);

        for (uint256 i = 0; i < path.length - 1; i++) {
            _swapStep(amounts, path, to, i);
        }
    }

    function _swapStep(uint256[] memory amounts, address[] calldata path, address to, uint256 i) internal {
        address input = path[i];
        address output = path[i + 1];
        address pair = _pair(input, output);
        if (pair == address(0)) revert PairNotFound();

        address t0 = IArcDEXPair(pair).token0();
        uint256 amountOut = amounts[i + 1];
        (uint256 amount0Out, uint256 amount1Out) = input == t0
            ? (uint256(0), amountOut)
            : (amountOut, uint256(0));

        address swapTo = i < path.length - 2 ? _pair(output, path[i + 2]) : to;
        IArcDEXPair(pair).swap(amount0Out, amount1Out, swapTo, "");
    }
}
