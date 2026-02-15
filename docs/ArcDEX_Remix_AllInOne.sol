// SPDX-License-Identifier: MIT
// =============================================================================
// ArcDEX ALL-IN-ONE — Remix (Arc Testnet, tokens precompile)
// =============================================================================
// 1. Cole ESTE ARQUIVO INTEIRO no Remix. Compile (0.8.20).
// 2. Deploy ArcDEXFactory → anote o endereço.
// 3. createPair(USDC, EURC) na Factory → anote o Pair.
// 4. Deploy ArcDEXRouter(_factory = endereço da Factory do passo 2).
// 5. Aprove USDC e EURC para o Router; chame Router.addLiquidity(...).
// 6. Atualize src/config/deployments.arc-testnet.json com factory + router.
// =============================================================================
pragma solidity ^0.8.20;

// --- TransferHelper (transfer + transferFrom compatíveis com precompile) ---
library TransferHelper {
    function safeTransfer(address token, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ArcDEX: TRANSFER_FAILED");
    }
    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ArcDEX: TRANSFER_FROM_FAILED");
    }
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

interface IArcDEXPair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
    function mint(address to) external returns (uint256 liquidity);
    function burn(address to) external returns (uint256 amount0, uint256 amount1);
    function initialize(address token0, address token1) external;
}

// --- Pair (swap e burn usam TransferHelper.safeTransfer) ---
contract ArcDEXPair {
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to);
    event Sync(uint112 reserve0, uint112 reserve1);

    function initialize(address _token0, address _token1) external {
        require(token0 == address(0), "ArcDEX: INITIALIZED");
        token0 = _token0;
        token1 = _token1;
    }

    function getReserves() external view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        _reserve0 = reserve0; _reserve1 = reserve1; _blockTimestampLast = blockTimestampLast;
    }

    function _update(uint112 _reserve0, uint112 _reserve1) private {
        reserve0 = _reserve0; reserve1 = _reserve1;
        blockTimestampLast = uint32(block.timestamp % 2**32);
        emit Sync(_reserve0, _reserve1);
    }

    function mint(address to) external returns (uint256 liquidity) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - _reserve0;
        uint256 amount1 = balance1 - _reserve1;
        if (totalSupply == 0) liquidity = sqrt(amount0 * amount1) - 1000;
        else liquidity = min((amount0 * totalSupply) / _reserve0, (amount1 * totalSupply) / _reserve1);
        require(liquidity > 0, "ArcDEX: INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);
        _update(uint112(balance0), uint112(balance1));
        emit Mint(msg.sender, amount0, amount1);
    }

    function burn(address to) external returns (uint256 amount0, uint256 amount1) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        address _token0 = token0;
        address _token1 = token1;
        uint256 balance0 = IERC20(_token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_token1).balanceOf(address(this));
        uint256 liquidity = balanceOf[address(this)];
        amount0 = (liquidity * balance0) / totalSupply;
        amount1 = (liquidity * balance1) / totalSupply;
        require(amount0 > 0 && amount1 > 0, "ArcDEX: INSUFFICIENT_LIQUIDITY_BURNED");
        _burn(address(this), liquidity);
        if (amount0 > 0) TransferHelper.safeTransfer(_token0, to, amount0);
        if (amount1 > 0) TransferHelper.safeTransfer(_token1, to, amount1);
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));
        _update(uint112(balance0), uint112(balance1));
        emit Burn(msg.sender, amount0, amount1, to);
    }

    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata) external {
        require(amount0Out > 0 || amount1Out > 0, "ArcDEX: INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1, "ArcDEX: INSUFFICIENT_LIQUIDITY");
        address _token0 = token0;
        address _token1 = token1;
        require(to != _token0 && to != _token1, "ArcDEX: INVALID_TO");
        if (amount0Out > 0) TransferHelper.safeTransfer(_token0, to, amount0Out);
        if (amount1Out > 0) TransferHelper.safeTransfer(_token1, to, amount1Out);
        uint256 balance0 = IERC20(_token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_token1).balanceOf(address(this));
        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "ArcDEX: INSUFFICIENT_INPUT_AMOUNT");
        uint256 b0Adj = balance0 * 1000 - amount0In * 3;
        uint256 b1Adj = balance1 * 1000 - amount1In * 3;
        require(b0Adj * b1Adj >= uint256(_reserve0) * _reserve1 * 1000**2, "ArcDEX: K");
        _update(uint112(balance0), uint112(balance1));
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
    }
    function _burn(address from, uint256 amount) internal {
        balanceOf[from] -= amount;
        totalSupply -= amount;
    }
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) { z = y; uint256 x = y / 2 + 1; while (x < z) { z = x; x = (y / x + x) / 2; } }
        else if (y != 0) z = 1;
    }
    function min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
}

// --- Factory ---
contract ArcDEXFactory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "ArcDEX: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ArcDEX: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "ArcDEX: PAIR_EXISTS");
        bytes memory bytecode = type(ArcDEXPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly { pair := create2(0, add(bytecode, 32), mload(bytecode), salt) }
        IArcDEXPair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
}

// --- Router (usa TransferHelper.safeTransferFrom; _pair via Factory.getPair, sem CREATE2) ---
interface IArcDEXFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

contract ArcDEXRouter {
    address public immutable factory;

    constructor(address _factory) {
        require(_factory != address(0), "ArcDEX: ZERO_FACTORY");
        factory = _factory;
    }

    function supportsPrecompileTokens() external pure returns (bool) { return true; }

    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) public pure returns (uint256 amountB) {
        require(amountA > 0 && reserveA > 0 && reserveB > 0, "ArcDEX: INSUFFICIENT");
        amountB = (amountA * reserveB) / reserveA;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(deadline >= block.timestamp, "ArcDEX: EXPIRED");
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = _pair(tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = IArcDEXPair(pair).mint(to);
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal view returns (uint256 amountA, uint256 amountB) {
        (uint256 reserveA, uint256 reserveB) = getReserves(tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            amountA = amountADesired;
            amountB = amountBDesired;
        } else {
            uint256 amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "ArcDEX: INSUFFICIENT_B");
                amountA = amountADesired;
                amountB = amountBOptimal;
            } else {
                uint256 amountAOptimal = quote(amountBDesired, reserveA, reserveB);
                require(amountAOptimal <= amountADesired && amountAOptimal >= amountAMin, "ArcDEX: INSUFFICIENT_A");
                amountA = amountAOptimal;
                amountB = amountBDesired;
            }
        }
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB) {
        require(deadline >= block.timestamp, "ArcDEX: EXPIRED");
        address pair = _pair(tokenA, tokenB);
        TransferHelper.safeTransferFrom(pair, msg.sender, pair, liquidity);
        (uint256 amount0, uint256 amount1) = IArcDEXPair(pair).burn(to);
        (address token0,) = sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin && amountB >= amountBMin, "ArcDEX: INSUFFICIENT_AMOUNTS");
    }

    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external returns (uint256[] memory amounts)
    {
        require(deadline >= block.timestamp, "ArcDEX: EXPIRED");
        require(path.length >= 2, "ArcDEX: INVALID_PATH");
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "ArcDEX: INSUFFICIENT_OUTPUT_AMOUNT");
        address pair0 = _pair(path[0], path[1]);
        TransferHelper.safeTransferFrom(path[0], msg.sender, pair0, amounts[0]);
        _swap(amounts, path, to);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path) public view returns (uint256[] memory amounts) {
        require(path.length >= 2, "ArcDEX: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
        require(amountIn > 0 && reserveIn > 0 && reserveOut > 0, "ArcDEX: INSUFFICIENT");
        amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997);
    }

    function _swap(uint256[] memory amounts, address[] memory path, address _to) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address token0,) = sortTokens(path[i], path[i + 1]);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = path[i] == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address to = i < path.length - 2 ? _pair(path[i + 1], path[i + 2]) : _to;
            IArcDEXPair(_pair(path[i], path[i + 1])).swap(amount0Out, amount1Out, to, "");
        }
    }

    function getReserves(address tokenA, address tokenB) public view returns (uint256 reserveA, uint256 reserveB) {
        (address token0,) = sortTokens(tokenA, tokenB);
        (uint256 reserve0, uint256 reserve1,) = IArcDEXPair(_pair(tokenA, tokenB)).getReserves();
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
        require(tokenA != tokenB && tokenA != address(0), "ArcDEX: INVALID");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }
}
