// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title WinnerVault
/// @notice Holds awarded principal and funded, withdrawable trading profits.
/// @dev Paper-trade PnL is a separate simulation ledger and is never withdrawable.
contract WinnerVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant USDC_UNIT = 1e6;
    uint256 private constant LOSS_PER_INSTALLMENT = 50 * USDC_UNIT;

    /// @notice A winner's vault account.
    struct Position {
        uint256 principal;
        uint256 fundedProfit;
        uint256 paperProfit;
        uint256 paperLoss;
        uint64 maturity;
        uint8 paidInstallments;
        bool blocked;
        bool claimed;
    }

    /// @notice The USDC token held by this vault.
    IERC20 public immutable usdc;
    /// @notice The Fund contract authorized to allocate and block positions.
    address public immutable fund;
    /// @notice Total principal and funded-profit liabilities backed by USDC.
    uint256 public totalLiabilities;

    mapping(uint256 boxId => mapping(address account => Position)) private positions;

    /// @notice A caller other than the Fund attempted an administrative operation.
    error OnlyFund();
    /// @notice A caller is not the position owner.
    error OnlyPositionOwner();
    /// @notice An invalid address or amount was supplied.
    error InvalidInput();
    /// @notice The position cannot perform the requested operation.
    error PositionUnavailable();
    /// @notice The caller attempted to claim principal before maturity.
    error NotMatured();
    /// @notice The requested loss exceeds the dynamic paper-trading limit.
    error StopLossExceeded();
    /// @notice The vault does not have enough tokens to back the requested liability.
    error Insolvent();

    /// @notice Emitted when a winning principal is assigned.
    event PrincipalAllocated(uint256 indexed boxId, address indexed account, uint256 amount, uint64 maturity);
    /// @notice Emitted when a paper trade is recorded.
    event PaperTradeRecorded(uint256 indexed boxId, address indexed account, int256 pnl);
    /// @notice Emitted when funded profits are credited.
    event FundedProfitCredited(uint256 indexed boxId, address indexed account, uint256 amount);
    /// @notice Emitted when profits are withdrawn.
    event ProfitWithdrawn(uint256 indexed boxId, address indexed account, uint256 amount);
    /// @notice Emitted when a mature position is claimed.
    event PositionClaimed(uint256 indexed boxId, address indexed account, uint256 principal, uint256 profit);
    /// @notice Emitted when a blocked position is returned to the Fund.
    event PositionForfeited(uint256 indexed boxId, address indexed account, uint256 amount);

    /// @notice Restricts a function to the Fund contract.
    modifier onlyFund() {
        if (msg.sender != fund) revert OnlyFund();
        _;
    }

    /// @notice Creates the vault.
    /// @param tokenAddress Address of the ERC-20 USDC token.
    /// @param fundAddress Address of the Fund contract.
    constructor(address tokenAddress, address fundAddress) {
        if (tokenAddress == address(0) || fundAddress == address(0)) revert InvalidInput();
        usdc = IERC20(tokenAddress);
        fund = fundAddress;
    }

    /// @notice Allocates a USDC-backed principal position to a winner.
    /// @dev The Fund must transfer `amount` to this contract before calling.
    /// @param boxId Box identifier.
    /// @param account Winner wallet.
    /// @param amount Principal amount in USDC base units.
    /// @param maturity Timestamp at which the principal may be claimed.
    /// @param paidInstallments Number of installments actually paid by the user.
    function allocatePrincipal(
        uint256 boxId,
        address account,
        uint256 amount,
        uint64 maturity,
        uint8 paidInstallments
    ) external onlyFund {
        if (account == address(0) || amount == 0 || maturity <= block.timestamp) revert InvalidInput();
        Position storage position = positions[boxId][account];
        if (position.principal != 0 || position.claimed) revert PositionUnavailable();
        if (usdc.balanceOf(address(this)) < totalLiabilities + amount) revert Insolvent();

        position.principal = amount;
        position.maturity = maturity;
        position.paidInstallments = paidInstallments;
        totalLiabilities += amount;
        emit PrincipalAllocated(boxId, account, amount, maturity);
    }

    /// @notice Updates the user's actual paid-installment count for risk limits.
    /// @param boxId Box identifier.
    /// @param account Position owner.
    /// @param paidInstallments Number of installments personally paid.
    function updatePaidInstallments(uint256 boxId, address account, uint8 paidInstallments) external onlyFund {
        Position storage position = positions[boxId][account];
        if (position.principal == 0 || position.claimed || position.blocked) revert PositionUnavailable();
        position.paidInstallments = paidInstallments;
    }

    /// @notice Blocks a position from trading and claiming.
    /// @param boxId Box identifier.
    /// @param account Position owner.
    function blockPosition(uint256 boxId, address account) external onlyFund {
        Position storage position = positions[boxId][account];
        if (position.principal == 0 || position.claimed || position.blocked) return;
        position.blocked = true;
    }

    /// @notice Forfeits a blocked position and returns its backed assets to Fund.
    /// @param boxId Box identifier.
    /// @param account Position owner.
    /// @return amount Principal and funded profits returned to Fund.
    function forfeitPosition(uint256 boxId, address account) external onlyFund nonReentrant returns (uint256 amount) {
        Position storage position = positions[boxId][account];
        if (!position.blocked || position.claimed) revert PositionUnavailable();

        amount = position.principal + position.fundedProfit;
        if (amount == 0) return 0;
        position.principal = 0;
        position.fundedProfit = 0;
        position.claimed = true;
        totalLiabilities -= amount;
        usdc.safeTransfer(fund, amount);
        emit PositionForfeited(boxId, account, amount);
    }

    /// @notice Records simulated PnL without moving or creating USDC.
    /// @dev Positive simulated PnL is not a withdrawable profit.
    /// @param boxId Box identifier.
    /// @param pnl Signed paper-trade result in USDC base units.
    function recordPaperTrade(uint256 boxId, int256 pnl) external {
        Position storage position = positions[boxId][msg.sender];
        if (position.principal == 0 || position.claimed || position.blocked) revert PositionUnavailable();
        if (pnl < 0) {
            if (pnl == type(int256).min) revert InvalidInput();
            uint256 loss = uint256(-pnl);
            uint256 absorbedByProfit = loss < position.paperProfit ? loss : position.paperProfit;
            position.paperProfit -= absorbedByProfit;
            uint256 principalExposure = loss - absorbedByProfit;
            uint256 limit = uint256(position.paidInstallments) * LOSS_PER_INSTALLMENT;
            if (position.paperLoss + principalExposure > limit) revert StopLossExceeded();
            position.paperLoss += principalExposure;
        } else {
            position.paperProfit += uint256(pnl);
        }
        emit PaperTradeRecorded(boxId, msg.sender, pnl);
    }

    /// @notice Credits profits only after the Fund has transferred real USDC.
    /// @param boxId Box identifier.
    /// @param account Position owner.
    /// @param amount Funded profit amount in USDC base units.
    function creditFundedProfit(uint256 boxId, address account, uint256 amount) external onlyFund {
        if (amount == 0) revert InvalidInput();
        Position storage position = positions[boxId][account];
        if (position.principal == 0 || position.claimed || position.blocked) revert PositionUnavailable();
        if (usdc.balanceOf(address(this)) < totalLiabilities + amount) revert Insolvent();

        position.fundedProfit += amount;
        totalLiabilities += amount;
        emit FundedProfitCredited(boxId, account, amount);
    }

    /// @notice Withdraws USDC-backed profits before or after maturity.
    /// @param boxId Box identifier.
    /// @param amount Profit amount in USDC base units.
    function withdrawProfit(uint256 boxId, uint256 amount) external nonReentrant {
        Position storage position = positions[boxId][msg.sender];
        if (position.principal == 0 || position.claimed || position.blocked || amount == 0) {
            revert PositionUnavailable();
        }
        if (amount > position.fundedProfit) revert InvalidInput();

        position.fundedProfit -= amount;
        totalLiabilities -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit ProfitWithdrawn(boxId, msg.sender, amount);
    }

    /// @notice Claims locked principal and remaining funded profits after maturity.
    /// @param boxId Box identifier.
    function claimMaturedPosition(uint256 boxId) external nonReentrant {
        Position storage position = positions[boxId][msg.sender];
        if (position.principal == 0 || position.claimed || position.blocked) revert PositionUnavailable();
        if (block.timestamp < position.maturity) revert NotMatured();

        uint256 principal = position.principal;
        uint256 profit = position.fundedProfit;
        position.principal = 0;
        position.fundedProfit = 0;
        position.claimed = true;
        totalLiabilities -= principal + profit;
        usdc.safeTransfer(msg.sender, principal + profit);
        emit PositionClaimed(boxId, msg.sender, principal, profit);
    }

    /// @notice Returns a user's vault position and dynamic loss limit.
    /// @param boxId Box identifier.
    /// @param account Position owner.
    /// @return position Principal, profits, paper balances, maturity, paid installments, and status.
    /// @return stopLossLimit Maximum cumulative simulated loss in USDC base units.
    function getPosition(
        uint256 boxId,
        address account
    ) external view returns (Position memory position, uint256 stopLossLimit) {
        position = positions[boxId][account];
        stopLossLimit = uint256(position.paidInstallments) * LOSS_PER_INSTALLMENT;
    }
}
