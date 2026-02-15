// SPDX-License-Identifier: MIT
// Versão corrigida do seu Router (use no Remix se preferir esta estrutura)
// Factory: 0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F
pragma solidity ^0.8.20;

// Use uma LIBRARY (não o contrato ERC20TransferHelper do repo).
// O contrato ERC20TransferHelper tem doTransfer(token, to, amount) e é para uso manual no Remix.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

library TransferHelper {
    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }
}

interface IArcDEXPair {
    function getReserves() external view returns (uint112, uint112, uint32);
    function token0() external view returns (address);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

interface IArcDEXFactory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

contract ArcDEXRouter {
    address public immutable factory;

    /// Obrigatório: o DApp chama isso para saber se é o Router novo (com TransferHelper).
    function supportsPrecompileTokens() external pure returns (bool) {
        return true;
    }

    constructor(address _factory) {
        require(_factory != address(0), "ZERO_FACTORY");
        factory = _factory;
    }

    function _pairFor(address tokenA, address tokenB) internal view returns (address pair) {
        pair = IArcDEXFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "PAIR_NOT_FOUND");
    }

    function _getReserves(address tokenA, address tokenB)
        internal
        view
        returns (uint256 reserveA, uint256 reserveB, address pair)
    {
        pair = _pairFor(tokenA, tokenB);
        (uint256 r0, uint256 r1,) = IArcDEXPair(pair).getReserves();
        if (tokenA == IArcDEXPair(pair).token0()) {
            (reserveA, reserveB) = (r0, r1);
        } else {
            (reserveA, reserveB) = (r1, r0);
        }
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        require(amountIn > 0, "INSUFFICIENT_INPUT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * 997;
        return (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts) {
        require(path.length >= 2, "BAD_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 0; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut,) = _getReserves(path[i], path[i + 1]);
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
        require(block.timestamp <= deadline, "EXPIRED");
        require(path.length >= 2, "BAD_PATH");

        (uint256 reserveIn, uint256 reserveOut, address pair) = _getReserves(path[0], path[1]);
        uint256 amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "INSUFFICIENT_OUTPUT");

        // Crítico para USDC precompile: use a library TransferHelper (aceita retorno vazio).
        TransferHelper.safeTransferFrom(path[0], msg.sender, pair, amountIn);

        if (path[0] == IArcDEXPair(pair).token0()) {
            IArcDEXPair(pair).swap(0, amountOut, to, "");
        } else {
            IArcDEXPair(pair).swap(amountOut, 0, to, "");
        }

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }
}
