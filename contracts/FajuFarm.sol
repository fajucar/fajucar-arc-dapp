// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FajuFarm
 * @notice MasterChef/Gauge-style LP staking rewards for ArcDEX V2 pairs.
 *         Stake LP -> earn FAJU -> claim.
 * @dev Ownable, ReentrancyGuard, SafeERC20. Configurable rewardPerSecond, startTime, endTime.
 */

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract FajuFarm {
    // --- ReentrancyGuard ---
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "FajuFarm: reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    // --- Ownable ---
    address public owner;
    modifier onlyOwner() {
        require(msg.sender == owner, "FajuFarm: not owner");
        _;
    }

    IERC20 public immutable rewardToken;
    uint256 public rewardPerSecond;
    uint256 public startTime;
    uint256 public endTime;

    uint256 public totalAllocPoint;
    uint256 public constant PRECISION = 1e12;

    struct PoolInfo {
        address lpToken;
        uint256 allocPoint;
        uint256 lastRewardTime;
        uint256 accRewardPerShare;
    }

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    event PoolAdded(uint256 indexed pid, address lpToken, uint256 allocPoint);
    event PoolSet(uint256 indexed pid, uint256 allocPoint);
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event Harvest(address indexed user, uint256 indexed pid, uint256 reward);
    event RewardPerSecondUpdated(uint256 oldRate, uint256 newRate);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        address _rewardToken,
        uint256 _rewardPerSecond,
        uint256 _startTime,
        uint256 _endTime
    ) {
        owner = msg.sender;
        rewardToken = IERC20(_rewardToken);
        rewardPerSecond = _rewardPerSecond;
        startTime = _startTime;
        endTime = _endTime == 0 ? type(uint256).max : _endTime;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function addPool(address _lpToken, uint256 _allocPoint) external onlyOwner {
        require(_lpToken != address(0), "FajuFarm: zero lp");
        totalAllocPoint += _allocPoint;
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardTime: block.timestamp,
            accRewardPerShare: 0
        }));
        emit PoolAdded(poolInfo.length - 1, _lpToken, _allocPoint);
    }

    function setPool(uint256 _pid, uint256 _allocPoint) external onlyOwner {
        require(_pid < poolInfo.length, "FajuFarm: bad pid");
        totalAllocPoint = totalAllocPoint - poolInfo[_pid].allocPoint + _allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        emit PoolSet(_pid, _allocPoint);
    }

    function _getMultiplier(uint256 _from, uint256 _to) internal view returns (uint256) {
        if (_to <= startTime) return 0;
        if (_from >= endTime) return 0;
        uint256 from = _from < startTime ? startTime : _from;
        uint256 to = _to > endTime ? endTime : _to;
        return to - from;
    }

    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.timestamp <= pool.lastRewardTime) return;
        uint256 lpSupply = IERC20(pool.lpToken).balanceOf(address(this));
        if (lpSupply == 0 || totalAllocPoint == 0) {
            pool.lastRewardTime = block.timestamp;
            return;
        }
        uint256 multiplier = _getMultiplier(pool.lastRewardTime, block.timestamp);
        uint256 reward = (multiplier * rewardPerSecond * pool.allocPoint) / totalAllocPoint;
        pool.accRewardPerShare += (reward * PRECISION) / lpSupply;
        pool.lastRewardTime = block.timestamp;
    }

    function pendingRewards(uint256 _pid, address _user) external view returns (uint256) {
        require(_pid < poolInfo.length, "FajuFarm: bad pid");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 lpSupply = IERC20(pool.lpToken).balanceOf(address(this));
        if (block.timestamp > pool.lastRewardTime && lpSupply > 0 && totalAllocPoint > 0) {
            uint256 multiplier = _getMultiplier(pool.lastRewardTime, block.timestamp);
            uint256 reward = (multiplier * rewardPerSecond * pool.allocPoint) / totalAllocPoint;
            accRewardPerShare += (reward * PRECISION) / lpSupply;
        }
        return (user.amount * accRewardPerShare) / PRECISION - user.rewardDebt;
    }

    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        require(_pid < poolInfo.length, "FajuFarm: bad pid");
        require(_amount > 0, "FajuFarm: zero amount");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accRewardPerShare) / PRECISION - user.rewardDebt;
            if (pending > 0) {
                _safeRewardTransfer(msg.sender, pending);
                emit Harvest(msg.sender, _pid, pending);
            }
        }
        IERC20(pool.lpToken).transferFrom(msg.sender, address(this), _amount);
        user.amount += _amount;
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / PRECISION;
        emit Deposit(msg.sender, _pid, _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {
        require(_pid < poolInfo.length, "FajuFarm: bad pid");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "FajuFarm: insufficient");
        updatePool(_pid);
        uint256 pending = (user.amount * pool.accRewardPerShare) / PRECISION - user.rewardDebt;
        if (pending > 0) {
            _safeRewardTransfer(msg.sender, pending);
            emit Harvest(msg.sender, _pid, pending);
        }
        user.amount -= _amount;
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / PRECISION;
        IERC20(pool.lpToken).transfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    function harvest(uint256 _pid) external nonReentrant {
        require(_pid < poolInfo.length, "FajuFarm: bad pid");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        uint256 pending = (user.amount * pool.accRewardPerShare) / PRECISION - user.rewardDebt;
        if (pending > 0) {
            user.rewardDebt = (user.amount * pool.accRewardPerShare) / PRECISION;
            _safeRewardTransfer(msg.sender, pending);
            emit Harvest(msg.sender, _pid, pending);
        }
    }

    function _safeRewardTransfer(address _to, uint256 _amount) internal {
        uint256 bal = rewardToken.balanceOf(address(this));
        if (_amount > bal) _amount = bal;
        if (_amount > 0) {
            (bool ok, bytes memory data) = address(rewardToken).call(
                abi.encodeWithSelector(IERC20.transfer.selector, _to, _amount)
            );
            require(ok && _transferOk(data), "FajuFarm: transfer failed");
        }
    }

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

    function setRewardPerSecond(uint256 _rewardPerSecond) external onlyOwner {
        uint256 old = rewardPerSecond;
        rewardPerSecond = _rewardPerSecond;
        emit RewardPerSecondUpdated(old, _rewardPerSecond);
    }

    function emergencyWithdraw(uint256 _pid) external nonReentrant {
        require(_pid < poolInfo.length, "FajuFarm: bad pid");
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 amount = user.amount;
        require(amount > 0, "FajuFarm: nothing to withdraw");
        user.amount = 0;
        user.rewardDebt = 0;
        IERC20(poolInfo[_pid].lpToken).transfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    function rescueReward(uint256 _amount) external onlyOwner {
        _safeRewardTransfer(owner, _amount);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "FajuFarm: zero owner");
        owner = _newOwner;
    }
}
