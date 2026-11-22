// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Draw
/// @notice Commit-reveal Fisher-Yates draws used by ArcQuant Fund.
/// @dev This is a testnet mechanism. A single fund owner can withhold a reveal.
contract Draw {
    /// @notice The fund contract allowed to commit and reveal draws.
    address public immutable fund;

    mapping(uint256 boxId => mapping(uint8 round => bytes32)) private commitments;
    mapping(uint256 boxId => mapping(uint8 round => bool)) public isDrawn;

    /// @notice A caller other than the fund attempted a draw operation.
    error OnlyFund();
    /// @notice A draw already has a commitment or has already completed.
    error DrawAlreadyStarted();
    /// @notice The supplied seed does not match the committed seed.
    error InvalidReveal();
    /// @notice The candidate list is too small to select the requested winners.
    error NotEnoughCandidates();
    /// @notice A zero address was supplied as the fund.
    error InvalidFund();

    /// @notice Emitted when a seed commitment is recorded.
    event SeedCommitted(uint256 indexed boxId, uint8 indexed round, bytes32 commitment);
    /// @notice Emitted after the seed is revealed and the winners are selected.
    event WinnersSelected(uint256 indexed boxId, uint8 indexed round, address[] winners);

    /// @notice Restricts draw operations to the associated Fund contract.
    modifier onlyFund() {
        if (msg.sender != fund) revert OnlyFund();
        _;
    }

    /// @notice Creates the draw helper for a Fund contract.
    /// @param fundAddress Address of the Fund contract.
    constructor(address fundAddress) {
        if (fundAddress == address(0)) revert InvalidFund();
        fund = fundAddress;
    }

    /// @notice Commits a seed for one box and round.
    /// @param boxId Box identifier.
    /// @param round Zero-based round number.
    /// @param commitment Hash of `abi.encode(seed, boxId, round)`.
    function commitSeed(uint256 boxId, uint8 round, bytes32 commitment) external onlyFund {
        if (commitment == bytes32(0) || commitments[boxId][round] != bytes32(0) || isDrawn[boxId][round]) {
            revert DrawAlreadyStarted();
        }
        commitments[boxId][round] = commitment;
        emit SeedCommitted(boxId, round, commitment);
    }

    /// @notice Reveals the committed seed and selects unique winners.
    /// @param boxId Box identifier.
    /// @param round Zero-based round number.
    /// @param seed The secret seed committed for this round.
    /// @param candidates Eligible member addresses in stable membership order.
    /// @param winnerCount Number of winners to select.
    /// @return winners The selected winner addresses.
    function revealAndSelect(
        uint256 boxId,
        uint8 round,
        bytes32 seed,
        address[] calldata candidates,
        uint8 winnerCount
    ) external onlyFund returns (address[] memory winners) {
        bytes32 commitment = commitments[boxId][round];
        if (
            commitment == bytes32(0) ||
            commitment != keccak256(abi.encode(seed, boxId, round)) ||
            isDrawn[boxId][round]
        ) revert InvalidReveal();
        if (candidates.length < winnerCount) revert NotEnoughCandidates();

        isDrawn[boxId][round] = true;
        delete commitments[boxId][round];

        address[] memory shuffled = candidates;
        for (uint256 i = shuffled.length; i > 1; --i) {
            uint256 j = uint256(keccak256(abi.encode(seed, boxId, round, i))) % i;
            (shuffled[i - 1], shuffled[j]) = (shuffled[j], shuffled[i - 1]);
        }

        winners = new address[](winnerCount);
        for (uint256 i; i < winnerCount; ++i) {
            winners[i] = shuffled[i];
        }
        emit WinnersSelected(boxId, round, winners);
    }

    /// @notice Returns the current seed commitment for a box and round.
    /// @param boxId Box identifier.
    /// @param round Zero-based round number.
    /// @return commitment The commitment, or zero when none exists.
    function seedCommitment(uint256 boxId, uint8 round) external view returns (bytes32 commitment) {
        return commitments[boxId][round];
    }
}
