// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArcDEXPair
 * @notice Pair completo estilo Uniswap V2 com LP token ERC20 embutido.
 *         Compatível com USDC precompile (0x3600...) e tokens ERC20 normais.
 */

// ----------------------------------------------------------------------------
// Interface ERC20 mínima (para tokens externos)
// ----------------------------------------------------------------------------
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// ----------------------------------------------------------------------------
// ArcDEXPair - Pair + LP Token ERC20 embutido
// ----------------------------------------------------------------------------
contract ArcDEXPair {
    /// @dev Aceita tokens que retornam vazio ou bool (ex. USDC precompile). Mesma lógica do Router _ok.
    function _transferOk(bytes memory data) private pure returns (bool) {
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

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, value)
        );
        require(success && _transferOk(data), "ArcDEX: TRANSFER_FAILED");
    }
    // Reentrancy lock
    uint256 private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, "ArcDEX: LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    // Pair state
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    // LP Token ERC20 state
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // Events
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Constants
    uint256 private constant MINIMUM_LIQUIDITY = 10**3;

    // ----------------------------------------------------------------------------
    // Initialization
    // ----------------------------------------------------------------------------
    function initialize(address _token0, address _token1) external {
        require(token0 == address(0), "ArcDEX: INITIALIZED");
        require(_token0 != address(0) && _token1 != address(0), "ArcDEX: ZERO_ADDRESS");
        require(_token0 != _token1, "ArcDEX: IDENTICAL_ADDRESSES");
        token0 = _token0;
        token1 = _token1;
    }

    // ----------------------------------------------------------------------------
    // View functions
    // ----------------------------------------------------------------------------
    function getReserves()
        public
        view
        returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)
    {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    // LP Token ERC20 view functions
    function name() public pure returns (string memory) {
        return "ArcDEX LP Token";
    }

    function symbol() public pure returns (string memory) {
        return "ARC-LP";
    }

    function decimals() public pure returns (uint8) {
        return 18;
    }

    // ----------------------------------------------------------------------------
    // LP Token ERC20 functions
    // ----------------------------------------------------------------------------
    function transfer(address to, uint256 value) external returns (bool) {
        require(balanceOf[msg.sender] >= value, "ArcDEX: INSUFFICIENT_BALANCE");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(balanceOf[from] >= value, "ArcDEX: INSUFFICIENT_BALANCE");
        require(allowance[from][msg.sender] >= value, "ArcDEX: INSUFFICIENT_ALLOWANCE");
        balanceOf[from] -= value;
        allowance[from][msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    // ----------------------------------------------------------------------------
    // Internal LP token functions
    // ----------------------------------------------------------------------------
    function _mint(address to, uint256 value) internal {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        balanceOf[from] -= value;
        totalSupply -= value;
        emit Transfer(from, address(0), value);
    }

    // ----------------------------------------------------------------------------
    // Reserve update
    // ----------------------------------------------------------------------------
    function _update(uint112 _reserve0, uint112 _reserve1) private {
        require(_reserve0 <= type(uint112).max && _reserve1 <= type(uint112).max, "ArcDEX: OVERFLOW");
        reserve0 = _reserve0;
        reserve1 = _reserve1;
        blockTimestampLast = uint32(block.timestamp % 2**32);
        emit Sync(_reserve0, _reserve1);
    }

    // ----------------------------------------------------------------------------
    // Mint liquidity
    // ----------------------------------------------------------------------------
    function mint(address to) external lock returns (uint256 liquidity) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - _reserve0;
        uint256 amount1 = balance1 - _reserve1;

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint256 _totalSupply = totalSupply;
        if (_totalSupply == 0) {
            liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0), MINIMUM_LIQUIDITY); // Lock forever
        } else {
            liquidity = min((amount0 * _totalSupply) / _reserve0, (amount1 * _totalSupply) / _reserve1);
        }
        require(liquidity > 0, "ArcDEX: INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);

        _update(uint112(balance0), uint112(balance1));
        if (feeOn) _kLast = uint256(reserve0) * reserve1;
        emit Mint(msg.sender, amount0, amount1);
    }

    // ----------------------------------------------------------------------------
    // Burn liquidity
    // ----------------------------------------------------------------------------
    function burn(address to) external lock returns (uint256 amount0, uint256 amount1) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        address _token0 = token0;
        address _token1 = token1;
        uint256 balance0 = IERC20(_token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_token1).balanceOf(address(this));
        uint256 liquidity = balanceOf[address(this)];

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint256 _totalSupply = totalSupply;
        amount0 = (liquidity * balance0) / _totalSupply;
        amount1 = (liquidity * balance1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "ArcDEX: INSUFFICIENT_LIQUIDITY_BURNED");
        _burn(address(this), liquidity);
        _safeTransfer(_token0, to, amount0);
        _safeTransfer(_token1, to, amount1);
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(uint112(balance0), uint112(balance1));
        if (feeOn) _kLast = uint256(reserve0) * reserve1;
        emit Burn(msg.sender, amount0, amount1, to);
    }

    // ----------------------------------------------------------------------------
    // Swap
    // ----------------------------------------------------------------------------
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata
    ) external lock {
        require(amount0Out > 0 || amount1Out > 0, "ArcDEX: INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1, "ArcDEX: INSUFFICIENT_LIQUIDITY");

        uint256 balance0;
        uint256 balance1;
        {
            address _token0 = token0;
            address _token1 = token1;
            require(to != _token0 && to != _token1, "ArcDEX: INVALID_TO");
            if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out);
            if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out);
            balance0 = IERC20(_token0).balanceOf(address(this));
            balance1 = IERC20(_token1).balanceOf(address(this));
        }
        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "ArcDEX: INSUFFICIENT_INPUT_AMOUNT");
        {
            uint256 balance0Adjusted = balance0 * 1000 - amount0In * 3;
            uint256 balance1Adjusted = balance1 * 1000 - amount1In * 3;
            require(balance0Adjusted * balance1Adjusted >= uint256(_reserve0) * _reserve1 * 1000**2, "ArcDEX: K");
        }
        _update(uint112(balance0), uint112(balance1));
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    // ----------------------------------------------------------------------------
    // Skim & Sync (para sincronizar reserves com balance real)
    // ----------------------------------------------------------------------------
    function skim(address to) external lock {
        address _token0 = token0;
        address _token1 = token1;
        _safeTransfer(_token0, to, IERC20(_token0).balanceOf(address(this)) - reserve0);
        _safeTransfer(_token1, to, IERC20(_token1).balanceOf(address(this)) - reserve1);
    }

    function sync() external lock {
        _update(
            uint112(IERC20(token0).balanceOf(address(this))),
            uint112(IERC20(token1).balanceOf(address(this)))
        );
    }

    // ----------------------------------------------------------------------------
    // Fee handling (simplificado - sem feeTo por enquanto)
    // ----------------------------------------------------------------------------
    uint256 private _kLast;

    function _mintFee(uint112 /*_reserve0*/, uint112 /*_reserve1*/) private returns (bool feeOn) {
        // Por enquanto, feeOn sempre false (sem feeTo)
        // Para implementar feeTo no futuro, seria necessário passar factory no initialize
        // e descomentar o código abaixo:
        /*
        address feeTo = IArcDEXFactory(factory).feeTo();
        feeOn = feeTo != address(0);
        if (feeOn) {
            if (_kLast != 0) {
                uint256 rootK = sqrt(uint256(_reserve0) * _reserve1);
                uint256 rootKLast = sqrt(_kLast);
                if (rootK > rootKLast) {
                    uint256 numerator = totalSupply * (rootK - rootKLast);
                    uint256 denominator = rootK * 5 + rootKLast;
                    uint256 liquidity = numerator / denominator;
                    if (liquidity > 0) _mint(feeTo, liquidity);
                }
            }
        } else if (_kLast != 0) {
            _kLast = 0;
        }
        */
        feeOn = false;
        if (_kLast != 0) {
            _kLast = 0;
        }
    }

    // ----------------------------------------------------------------------------
    // Math helpers
    // ----------------------------------------------------------------------------
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
