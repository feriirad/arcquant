// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Draw} from "./Draw.sol";
import {WinnerVault} from "./WinnerVault.sol";

/// @title Fund
/// @notice Manages 100-member, 20-round savings boxes and funded winner draws.
/// @dev USDC must have six decimals. Randomness is commit-reveal and is not
///      suitable for high-value production use without an independent VRF.
contract Fund is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant USDC_UNIT = 1e6;
    uint256 public constant BOX_CAPACITY = 100;
    uint256 public constant WINNERS_PER_ROUND = 5;
    uint256 public constant CYCLE_ROUNDS = 20;
    uint256 public constant ROUND_DURATION = 30 days;
    uint256 public constant ENTRY_AMOUNT = 52 * USDC_UNIT;
    uint256 public constant FEE_AMOUNT = 2 * USDC_UNIT;
    uint256 public constant PRIZE_CONTRIBUTION = 50 * USDC_UNIT;
    uint256 public constant WINNER_PRINCIPAL = 1_000 * USDC_UNIT;
    uint256 public constant ROUND_PRIZE_POOL = 5_000 * USDC_UNIT;

    /// @notice Summary of a savings box.
    struct Box {
        uint64 startedAt;
        uint8 membersCount;
        uint8 nextRound;
        uint256 prizePool;
        bool started;
        bool completed;
    }

    /// @notice One wallet's status in one box.
    struct Member {
        bool joined;
        bool blocked;
        bool hasWon;
        uint8 paidInstallments;
        uint8 winRound;
    }

    /// @notice The USDC token used for installments and prizes.
    IERC20 public immutable usdc;
    /// @notice The commit-reveal draw helper deployed with this contract.
    Draw public immutable draw;
    /// @notice The vault deployed with this contract.
    WinnerVault public immutable vault;
    /// @notice Address receiving the 2 USDC fee from each installment.
    address public feeRecipient;
    /// @notice Current box accepting new members.
    uint256 public currentBoxId = 1;
    /// @notice Real USDC reserved for operator-sponsored installments and refunds.
    uint256 public sponsorReserve;

    mapping(uint256 boxId => Box) private boxes;
    mapping(uint256 boxId => address[]) private boxMembers;
    mapping(uint256 boxId => mapping(address account => Member)) private members;
    mapping(uint256 boxId => mapping(address account => uint256)) private paidRounds;
    mapping(uint256 boxId => mapping(address account => uint256)) private userPaidRounds;
    mapping(uint256 boxId => mapping(address account => uint256)) private sponsoredRounds;
    mapping(uint256 boxId => mapping(uint8 round => bool)) public drawCommitted;
    mapping(uint256 boxId => mapping(uint8 round => uint256)) public drawCommitBlock;
    mapping(uint256 boxId => mapping(address account => bool)) public refundClaimed;
    mapping(address account => uint256) public activeBoxOf;

    /// @notice A zero address or invalid amount was supplied.
    error InvalidInput();
    /// @notice The requested box does not exist or is not in the required state.
    error InvalidBoxState();
    /// @notice The caller is not an eligible box member.
    error NotMember();
    /// @notice The caller's account is blocked.
    error AccountBlocked();
    /// @notice The box is already full.
    error BoxFull();
    /// @notice The member has an active account in another box.
    error ActiveMembershipExists();
    /// @notice The member has no installment due.
    error NoInstallmentDue();
    /// @notice More than one missed month plus the grace month is outstanding.
    error TooManyOverdueInstallments();
    /// @notice The operator reserve does not contain enough real USDC.
    error InsufficientSponsorReserve();
    /// @notice A required installment for the round is not yet funded.
    error RoundNotFunded();
    /// @notice A draw's commit/reveal or round sequence is invalid.
    error InvalidDrawState();
    /// @notice A blocked member cannot claim a refund before the cycle matures.
    error RefundNotAvailable();
    /// @notice The requested refund has already been claimed.
    error RefundAlreadyClaimed();

    /// @notice Emitted when a wallet joins a box.
    event MemberJoined(uint256 indexed boxId, address indexed account, uint8 membersCount);
    /// @notice Emitted when a box reaches capacity and its cycle starts.
    event BoxStarted(uint256 indexed boxId, uint64 startedAt);
    /// @notice Emitted when an installment is paid or reimbursed by its member.
    event InstallmentPaid(uint256 indexed boxId, address indexed account, uint8 indexed round, bool reimbursed);
    /// @notice Emitted when the operator funds a member's missed installment.
    event InstallmentSponsored(uint256 indexed boxId, address indexed account, uint8 indexed round);
    /// @notice Emitted when a member account becomes blocked.
    event MemberBlocked(uint256 indexed boxId, address indexed account);
    /// @notice Emitted when the operator reserve receives real USDC.
    event SponsorReserveFunded(address indexed sponsor, uint256 amount);
    /// @notice Emitted when a round's seed commitment is recorded.
    event DrawCommitted(uint256 indexed boxId, uint8 indexed round, bytes32 commitment);
    /// @notice Emitted when a member wins a round.
    event MemberWon(uint256 indexed boxId, uint8 indexed round, address indexed account, bool operatorOwned);
    /// @notice Emitted when a blocked member receives an installment refund.
    event BlockedMemberRefunded(uint256 indexed boxId, address indexed account, uint256 amount);
    /// @notice Emitted when the fee recipient changes.
    event FeeRecipientChanged(address indexed previousRecipient, address indexed newRecipient);
    /// @notice Emitted when a funded trading profit is credited to a winner.
    event FundedProfitCredited(uint256 indexed boxId, address indexed account, uint256 amount);

    /// @notice Creates Fund, Draw, and WinnerVault contracts.
    /// @param tokenAddress Address of six-decimal USDC.
    /// @param initialFeeRecipient Address receiving installment fees.
    constructor(address tokenAddress, address initialFeeRecipient) Ownable(msg.sender) {
        if (tokenAddress == address(0) || initialFeeRecipient == address(0)) revert InvalidInput();
        usdc = IERC20(tokenAddress);
        feeRecipient = initialFeeRecipient;
        draw = new Draw(address(this));
        vault = new WinnerVault(tokenAddress, address(this));
    }

    /// @notice Joins the current box and pays its first 52 USDC installment.
    /// @dev The caller must approve this contract to spend 52 USDC.
    function joinBox() external nonReentrant {
        uint256 boxId = currentBoxId;
        Box storage box = boxes[boxId];
        if (box.membersCount >= BOX_CAPACITY) revert BoxFull();
        if (members[boxId][msg.sender].joined) revert ActiveMembershipExists();
        uint256 priorBoxId = activeBoxOf[msg.sender];
        if (priorBoxId != 0 && !boxes[priorBoxId].completed) revert ActiveMembershipExists();

        usdc.safeTransferFrom(msg.sender, address(this), ENTRY_AMOUNT);
        _allocateInstallment(boxId, msg.sender, 0, false);
        userPaidRounds[boxId][msg.sender] |= _roundBit(0);

        Member storage member = members[boxId][msg.sender];
        member.joined = true;
        member.paidInstallments = 1;
        boxMembers[boxId].push(msg.sender);
        ++box.membersCount;
        activeBoxOf[msg.sender] = boxId;

        emit MemberJoined(boxId, msg.sender, box.membersCount);
        if (box.membersCount == BOX_CAPACITY) {
            box.startedAt = uint64(block.timestamp);
            box.started = true;
            currentBoxId = boxId + 1;
            emit BoxStarted(boxId, box.startedAt);
        }
    }

    /// @notice Pays all currently due installments, including any operator-sponsored arrears.
    /// @dev Non-winners may pay at most two installments to use their one-month grace period.
    function payInstallment(uint256 boxId) external nonReentrant {
        Box storage box = boxes[boxId];
        Member storage member = members[boxId][msg.sender];
        if (!member.joined) revert NotMember();
        if (member.blocked) revert AccountBlocked();
        if (!box.started || box.completed) revert InvalidBoxState();

        uint8 dueRound = box.nextRound;
        if (block.timestamp < uint256(box.startedAt) + uint256(dueRound) * ROUND_DURATION) {
            revert NoInstallmentDue();
        }
        uint8 owedCount;
        for (uint8 round; round <= dueRound; ++round) {
            if (!_isSet(userPaidRounds[boxId][msg.sender], round)) ++owedCount;
        }
        if (owedCount == 0) revert NoInstallmentDue();
        if (owedCount > 2) revert TooManyOverdueInstallments();

        for (uint8 round; round <= dueRound; ++round) {
            if (_isSet(userPaidRounds[boxId][msg.sender], round)) continue;

            bool reimbursed = _isSet(sponsoredRounds[boxId][msg.sender], round);
            if (reimbursed) {
                usdc.safeTransferFrom(msg.sender, address(this), ENTRY_AMOUNT);
                sponsorReserve += ENTRY_AMOUNT;
            } else {
                usdc.safeTransferFrom(msg.sender, address(this), ENTRY_AMOUNT);
                _allocateInstallment(boxId, msg.sender, round, false);
            }

            userPaidRounds[boxId][msg.sender] |= _roundBit(round);
            paidRounds[boxId][msg.sender] |= _roundBit(round);
            ++member.paidInstallments;
            emit InstallmentPaid(boxId, msg.sender, round, reimbursed);
        }

        if (member.hasWon) {
            vault.updatePaidInstallments(boxId, msg.sender, member.paidInstallments);
        }
    }

    /// @notice Funds the operator reserve with real USDC.
    /// @dev The owner must approve this contract before calling.
    /// @param amount Amount of USDC base units to deposit.
    function fundSponsorReserve(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidInput();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        sponsorReserve += amount;
        emit SponsorReserveFunded(msg.sender, amount);
    }

    /// @notice Pays the next due round for all members from the funded operator reserve.
    /// @dev The owner must call this to keep a box moving when members miss payments.
    /// @param boxId Box identifier.
    function sponsorCurrentRound(uint256 boxId) external onlyOwner nonReentrant {
        Box storage box = boxes[boxId];
        if (!box.started || box.completed || box.nextRound >= CYCLE_ROUNDS) revert InvalidBoxState();
        uint8 round = box.nextRound;
        if (block.timestamp < uint256(box.startedAt) + uint256(round) * ROUND_DURATION) {
            revert InvalidBoxState();
        }

        address[] storage accounts = boxMembers[boxId];
        for (uint256 i; i < accounts.length; ++i) {
            address account = accounts[i];
            if (_isSet(paidRounds[boxId][account], round)) continue;

            Member storage member = members[boxId][account];
            if (member.hasWon) {
                _blockMember(boxId, account, member);
            } else if (_hasUnpaidSponsorshipBefore(boxId, account, round)) {
                uint8 firstMissed = _firstUnpaidSponsoredRound(boxId, account, round);
                if (round >= firstMissed + 2) _blockMember(boxId, account, member);
            }

            _sponsorInstallment(boxId, account, round);
        }
    }

    /// @notice Commits the seed hash for the box's next fully funded round.
    /// @param boxId Box identifier.
    /// @param commitment `keccak256(abi.encode(seed, boxId, round))`.
    function commitDraw(uint256 boxId, bytes32 commitment) external onlyOwner {
        Box storage box = boxes[boxId];
        if (
            !box.started ||
            box.completed ||
            box.nextRound >= CYCLE_ROUNDS ||
            box.prizePool != ROUND_PRIZE_POOL ||
            block.timestamp < uint256(box.startedAt) + uint256(box.nextRound) * ROUND_DURATION ||
            drawCommitted[boxId][box.nextRound]
        ) revert RoundNotFunded();

        drawCommitted[boxId][box.nextRound] = true;
        drawCommitBlock[boxId][box.nextRound] = block.number;
        draw.commitSeed(boxId, box.nextRound, commitment);
        emit DrawCommitted(boxId, box.nextRound, commitment);
    }

    /// @notice Reveals the committed seed and distributes the round's five 1,000 USDC awards.
    /// @param boxId Box identifier.
    /// @param seed Secret seed matching the prior commitment.
    function revealDraw(uint256 boxId, bytes32 seed) external onlyOwner nonReentrant {
        Box storage box = boxes[boxId];
        uint8 round = box.nextRound;
        if (
            !box.started ||
            box.completed ||
            round >= CYCLE_ROUNDS ||
            !drawCommitted[boxId][round] ||
            block.number <= drawCommitBlock[boxId][round] ||
            box.prizePool != ROUND_PRIZE_POOL
        ) revert InvalidDrawState();

        address[] storage accounts = boxMembers[boxId];
        address[] memory candidates = new address[](BOX_CAPACITY);
        uint256 candidateCount;
        for (uint256 i; i < accounts.length; ++i) {
            if (!members[boxId][accounts[i]].hasWon) {
                candidates[candidateCount] = accounts[i];
                ++candidateCount;
            }
        }
        assembly {
            mstore(candidates, candidateCount)
        }

        address[] memory winners = draw.revealAndSelect(boxId, round, seed, candidates, uint8(WINNERS_PER_ROUND));
        box.prizePool = 0;
        delete drawCommitted[boxId][round];

        uint64 maturity = uint64(uint256(box.startedAt) + CYCLE_ROUNDS * ROUND_DURATION);
        for (uint256 i; i < winners.length; ++i) {
            address account = winners[i];
            Member storage member = members[boxId][account];
            member.hasWon = true;
            member.winRound = round + 1;

            bool operatorOwned = member.blocked || _hasUnpaidSponsoredThrough(boxId, account, round);
            if (operatorOwned && !member.blocked) {
                _blockMember(boxId, account, member);
            }

            if (member.blocked) {
                sponsorReserve += WINNER_PRINCIPAL;
            } else {
                usdc.safeTransfer(address(vault), WINNER_PRINCIPAL);
                vault.allocatePrincipal(boxId, account, WINNER_PRINCIPAL, maturity, member.paidInstallments);
            }

            emit MemberWon(boxId, round, account, member.blocked);
        }

        ++box.nextRound;
        if (box.nextRound == CYCLE_ROUNDS) box.completed = true;
    }

    /// @notice Claims the refund of installments actually paid by a blocked member after month 20.
    /// @dev Refunds are paid only from real sponsor-reserve USDC and may revert until funded.
    /// @param boxId Box identifier.
    function claimBlockedRefund(uint256 boxId) external nonReentrant {
        Box storage box = boxes[boxId];
        Member storage member = members[boxId][msg.sender];
        if (!member.joined || !member.blocked || !box.completed) revert RefundNotAvailable();
        if (block.timestamp < uint256(box.startedAt) + CYCLE_ROUNDS * ROUND_DURATION) {
            revert RefundNotAvailable();
        }
        if (refundClaimed[boxId][msg.sender]) revert RefundAlreadyClaimed();

        uint256 amount = uint256(member.paidInstallments) * ENTRY_AMOUNT;
        if (amount == 0 || sponsorReserve < amount) revert InsufficientSponsorReserve();
        refundClaimed[boxId][msg.sender] = true;
        sponsorReserve -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit BlockedMemberRefunded(boxId, msg.sender, amount);
    }

    /// @notice Credits a winner with real USDC trading profits deposited by the owner.
    /// @dev The owner must approve this contract for `amount` before calling.
    /// @param boxId Box identifier.
    /// @param account Winner wallet.
    /// @param amount Profit amount in USDC base units.
    function creditFundedProfit(
        uint256 boxId,
        address account,
        uint256 amount
    ) external onlyOwner nonReentrant {
        Member storage member = members[boxId][account];
        if (!member.joined || !member.hasWon || member.blocked) revert NotMember();
        usdc.safeTransferFrom(msg.sender, address(vault), amount);
        vault.creditFundedProfit(boxId, account, amount);
        emit FundedProfitCredited(boxId, account, amount);
    }

    /// @notice Updates the fee recipient.
    /// @param newRecipient New fee-recipient address.
    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert InvalidInput();
        address previousRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientChanged(previousRecipient, newRecipient);
    }

    /// @notice Returns box status and the current round's funding progress.
    /// @param boxId Box identifier.
    /// @return box The box summary.
    /// @return fundedMembers Number of members funded for the next round.
    function getBoxStatus(uint256 boxId) external view returns (Box memory box, uint8 fundedMembers) {
        box = boxes[boxId];
        if (!box.started || box.completed) return (box, 0);

        address[] storage accounts = boxMembers[boxId];
        for (uint256 i; i < accounts.length; ++i) {
            if (_isSet(paidRounds[boxId][accounts[i]], box.nextRound)) ++fundedMembers;
        }
    }

    /// @notice Returns membership and payment information for a wallet.
    /// @param boxId Box identifier.
    /// @param account Wallet to inspect.
    /// @return member Member summary.
    /// @return personalRounds Bitmap of installments actually paid by the user.
    /// @return operatorRounds Bitmap of installments initially funded by the operator.
    /// @return stopLossLimit Dynamic simulated loss limit in USDC base units.
    function getMemberStatus(
        uint256 boxId,
        address account
    )
        external
        view
        returns (Member memory member, uint256 personalRounds, uint256 operatorRounds, uint256 stopLossLimit)
    {
        member = members[boxId][account];
        personalRounds = userPaidRounds[boxId][account];
        operatorRounds = sponsoredRounds[boxId][account];
        stopLossLimit = uint256(member.paidInstallments) * 50 * USDC_UNIT;
    }

    /// @notice Returns the wallets in a box in their stable join order.
    /// @param boxId Box identifier.
    /// @return accounts Member wallet addresses.
    function getMembers(uint256 boxId) external view returns (address[] memory accounts) {
        return boxMembers[boxId];
    }

    /// @notice Returns the number of personal installments paid by a member.
    /// @param boxId Box identifier.
    /// @param account Member wallet.
    /// @return paidCount Number of actually paid installments.
    function getPaidInstallmentCount(uint256 boxId, address account) external view returns (uint8 paidCount) {
        return members[boxId][account].paidInstallments;
    }

    /// @notice Routes 2 USDC to fees and 50 USDC to the current round's pool.
    /// @param boxId Box identifier.
    /// @param account Member wallet.
    /// @param round Zero-based installment round.
    /// @param sponsored Whether the operator funded the installment.
    function _allocateInstallment(uint256 boxId, address account, uint8 round, bool sponsored) private {
        Box storage box = boxes[boxId];
        usdc.safeTransfer(feeRecipient, FEE_AMOUNT);
        box.prizePool += PRIZE_CONTRIBUTION;
        paidRounds[boxId][account] |= _roundBit(round);
        if (sponsored) sponsoredRounds[boxId][account] |= _roundBit(round);
    }

    /// @notice Pays one missed installment from the real operator reserve.
    /// @param boxId Box identifier.
    /// @param account Member wallet.
    /// @param round Zero-based round.
    function _sponsorInstallment(uint256 boxId, address account, uint8 round) private {
        if (sponsorReserve < ENTRY_AMOUNT) revert InsufficientSponsorReserve();
        sponsorReserve -= ENTRY_AMOUNT;
        _allocateInstallment(boxId, account, round, true);
        emit InstallmentSponsored(boxId, account, round);
    }

    /// @notice Blocks a member and returns any existing winner position to the reserve.
    /// @param boxId Box identifier.
    /// @param account Member wallet.
    /// @param member Member storage record.
    function _blockMember(uint256 boxId, address account, Member storage member) private {
        if (member.blocked) return;
        member.blocked = true;
        emit MemberBlocked(boxId, account);

        if (member.hasWon) {
            (WinnerVault.Position memory position, ) = vault.getPosition(boxId, account);
            if (position.principal != 0 && !position.claimed) {
                vault.blockPosition(boxId, account);
                uint256 recovered = vault.forfeitPosition(boxId, account);
                sponsorReserve += recovered;
            }
        }
    }

    /// @notice Checks whether a member has an unpaid operator-funded round.
    /// @param boxId Box identifier.
    /// @param account Member wallet.
    /// @param beforeRound Exclusive upper bound.
    /// @return unpaid True if an earlier sponsorship remains unreimbursed.
    function _hasUnpaidSponsorshipBefore(
        uint256 boxId,
        address account,
        uint8 beforeRound
    ) private view returns (bool unpaid) {
        for (uint8 round; round < beforeRound; ++round) {
            if (
                _isSet(sponsoredRounds[boxId][account], round) &&
                !_isSet(userPaidRounds[boxId][account], round)
            ) return true;
        }
    }

    /// @notice Checks whether an operator-funded installment remains unpaid by a member.
    /// @param boxId Box identifier.
    /// @param account Member wallet.
    /// @param throughRound Inclusive upper bound.
    /// @return unpaid True if an operator-funded installment remains unpaid.
    function _hasUnpaidSponsoredThrough(
        uint256 boxId,
        address account,
        uint8 throughRound
    ) private view returns (bool unpaid) {
        for (uint8 round; round <= throughRound; ++round) {
            if (
                _isSet(sponsoredRounds[boxId][account], round) &&
                !_isSet(userPaidRounds[boxId][account], round)
            ) return true;
        }
    }

    /// @notice Finds the earliest operator-funded installment not reimbursed by the member.
    /// @param boxId Box identifier.
    /// @param account Member wallet.
    /// @param beforeRound Exclusive upper bound.
    /// @return firstRound Earliest missed round.
    function _firstUnpaidSponsoredRound(
        uint256 boxId,
        address account,
        uint8 beforeRound
    ) private view returns (uint8 firstRound) {
        for (uint8 round; round < beforeRound; ++round) {
            if (
                _isSet(sponsoredRounds[boxId][account], round) &&
                !_isSet(userPaidRounds[boxId][account], round)
            ) return round;
        }
    }

    /// @notice Returns whether the specified round bit is set.
    /// @param bitmap Packed round bitmap.
    /// @param round Zero-based round.
    /// @return set True if the bit is set.
    function _isSet(uint256 bitmap, uint8 round) private pure returns (bool set) {
        return bitmap & _roundBit(round) != 0;
    }

    /// @notice Returns the bitmap bit for a round.
    /// @param round Zero-based round.
    /// @return bit Round bit.
    function _roundBit(uint8 round) private pure returns (uint256 bit) {
        return uint256(1) << round;
    }
}
