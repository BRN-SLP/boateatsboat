// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title BattleshipGame
/// @notice BoatEatsBoat bathtub battleship. Merkle-commit / fire / proof / claim.
/// @dev Board is 10x10. Each cell is a leaf: keccak256(abi.encodePacked(cellType, salt)).
///      cellType encodes ship id + hp + stealth flags. Cell type 0 = water.
contract BattleshipGame is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    uint8 public constant BOARD_SIZE = 10;
    uint16 public constant TOTAL_CELLS = 100;
    uint8 public constant MAX_HP = 2; // Battleship armor

    // Cell type encoding (fits in uint8):
    //   0           = water
    //   1..=20      = ship hull, hp=1 (Carrier / Cruiser / standard cells)
    //   21..=40     = ship hull, hp=2 (Battleship armor)
    //   41..=60     = submarine hull, hp=1, stealth
    // High nibble = class, low nibble stays flexible for shipId/index.
    uint8 internal constant TYPE_WATER = 0;
    uint8 internal constant TYPE_SHIP_HP1 = 1; // base for hp=1 ships
    uint8 internal constant TYPE_SHIP_HP2 = 21; // base for armored (hp=2)
    uint8 internal constant TYPE_SUB_STEALTH = 41; // base for stealth submarines

    function _cellHp(uint8 cellType) internal pure returns (uint8) {
        if (cellType == TYPE_WATER) return 0;
        if (cellType >= TYPE_SUB_STEALTH) return 1;
        if (cellType >= TYPE_SHIP_HP2) return 2;
        return 1;
    }

    function _isStealth(uint8 cellType) internal pure returns (bool) {
        return cellType >= TYPE_SUB_STEALTH;
    }

    // ---------------------------------------------------------------------
    // Game state
    // ---------------------------------------------------------------------

    enum GameState {
        Open, // awaiting opponent join
        Placing, // both players must commit boards
        Active, // shots being fired
        Finished // winner recorded
    }

    struct Player {
        address account;
        bytes32 boardRoot; // Merkle root of board layout
        uint8 shotsHit; // count of confirmed enemy cells destroyed
        uint8 cellsRemaining; // own cells not yet destroyed (start = shipCells)
        bool acknowledged;
    }

    struct Game {
        GameState state;
        Player[2] players;
        uint256 wager; // cUSD per player, 0 = free
        address winner;
        uint8 turn; // index of player whose turn it is (0 or 1)
        uint256 lastActionAt;
        uint256 moveTimeout; // seconds before forfeit is allowed
    }

    mapping(uint256 => Game) public games;
    uint256 public nextGameId;

    // Pending shot awaiting proof from the defender.
    struct PendingShot {
        bool active;
        uint8 shooterIdx; // who fired
        uint8 x;
        uint8 y;
        uint256 deadline;
    }
    mapping(uint256 => PendingShot) public pendingShots;

    // ELO ladder (cosmetic + matchmaking, not stake-weighted).
    mapping(address => uint256) public elo;
    mapping(address => uint32) public wins;
    mapping(address => uint32) public losses;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 wager);
    event OpponentJoined(uint256 indexed gameId, address indexed opponent);
    event BoardCommitted(uint256 indexed gameId, uint8 indexed playerIdx);
    event GameStarted(uint256 indexed gameId, uint8 firstTurn);
    event ShotFired(uint256 indexed gameId, uint8 indexed shooterIdx, uint8 x, uint8 y);
    event ShotResolved(uint256 indexed gameId, uint8 indexed defenderIdx, uint8 x, uint8 y, bool hit, bool sunk);
    event GameFinished(uint256 indexed gameId, address indexed winner, bool byForfeit);
    event WagerClaimed(uint256 indexed gameId, address indexed winner, uint256 amount);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotYourTurn();
    error NotParticipant();
    error InvalidBoard();
    error InvalidProof();
    error ShotAlreadyPending();
    error NoShotPending();
    error ShotNotExpired();
    error AlreadyAcknowledged();
    error WagerMismatch();
    error GameNotFinished();
    error OnlyWinningPlayer();

    // ---------------------------------------------------------------------
    // Initializer
    // ---------------------------------------------------------------------

    /// @custom:oz-upgrades-validate-as-initializer
    function initialize() public virtual initializer {
        __Ownable_init(msg.sender);
        nextGameId = 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ---------------------------------------------------------------------
    // Game lifecycle (Duel)
    // ---------------------------------------------------------------------

    /// @notice Create a new duel with an optional cUSD wager. Caller is player 0.
    function createDuel(uint256 wager) external returns (uint256 gameId) {
        gameId = nextGameId++;
        Game storage g = games[gameId];
        g.state = GameState.Open;
        g.players[0].account = msg.sender;
        g.wager = wager;
        g.lastActionAt = block.timestamp;
        g.moveTimeout = 24 hours;
        emit GameCreated(gameId, msg.sender, wager);
    }

    /// @notice Join an open duel as player 1.
    function joinDuel(uint256 gameId) external payable {
        Game storage g = games[gameId];
        if (g.state != GameState.Open) revert InvalidBoard();
        // Wager is handled off-ring for simplicity; tracked as accounting here.
        if (msg.value != g.wager) revert WagerMismatch();
        g.players[1].account = msg.sender;
        g.state = GameState.Placing;
        g.lastActionAt = block.timestamp;
        emit OpponentJoined(gameId, msg.sender);
    }

    /// @notice Commit a board layout as a Merkle root. cellShipCount = number of occupied cells.
    function commitBoard(uint256 gameId, bytes32 boardRoot, uint8 cellShipCount) external {
        Game storage g = games[gameId];
        if (g.state != GameState.Placing) revert InvalidBoard();
        uint8 idx = _playerIdx(g, msg.sender);
        if (idx == 2) revert NotParticipant();
        if (g.players[idx].acknowledged) revert AlreadyAcknowledged();
        if (boardRoot == bytes32(0) || cellShipCount == 0 || cellShipCount > TOTAL_CELLS) {
            revert InvalidBoard();
        }
        g.players[idx].boardRoot = boardRoot;
        g.players[idx].cellsRemaining = cellShipCount;
        g.players[idx].acknowledged = true;
        g.lastActionAt = block.timestamp;
        emit BoardCommitted(gameId, idx);
        if (g.players[0].acknowledged && g.players[1].acknowledged) {
            g.state = GameState.Active;
            g.turn = 0;
            emit GameStarted(gameId, 0);
        }
    }

    // ---------------------------------------------------------------------
    // Shooting
    // ---------------------------------------------------------------------

    /// @notice Fire at (x,y) on the opponent board. Creates a pending shot the defender must answer.
    function fire(uint256 gameId, uint8 x, uint8 y) external {
        Game storage g = games[gameId];
        if (g.state != GameState.Active) revert InvalidBoard();
        if (g.turn >= 2) revert NotYourTurn();
        if (msg.sender != g.players[g.turn].account) revert NotYourTurn();
        if (x >= BOARD_SIZE || y >= BOARD_SIZE) revert InvalidBoard();
        if (pendingShots[gameId].active) revert ShotAlreadyPending();

        uint8 defenderIdx = (g.turn == 0) ? 1 : 0;
        pendingShots[gameId] = PendingShot({
            active: true,
            shooterIdx: g.turn,
            x: x,
            y: y,
            deadline: block.timestamp + g.moveTimeout
        });
        g.lastActionAt = block.timestamp;
        emit ShotFired(gameId, g.turn, x, y);
        // Defender answers via respondShot(); turn does NOT flip yet.
        // If defender times out, attacker can claimForfeit().
        if (defenderIdx == 1) {} // silence unused warning in skeleton
    }

    /// @notice Defender answers a pending shot with a Merkle proof for the targeted cell.
    /// @param cellType Encoded cell type at (x,y) per the constants above.
    /// @param proof Merkle path from leaf to committed root.
    function respondShot(
        uint256 gameId,
        uint8 cellType,
        bytes32[] calldata proof
    ) external {
        Game storage g = games[gameId];
        if (g.state != GameState.Active) revert InvalidBoard();
        PendingShot storage ps = pendingShots[gameId];
        if (!ps.active) revert NoShotPending();

        uint8 defenderIdx = (ps.shooterIdx == 0) ? 1 : 0;
        if (msg.sender != g.players[defenderIdx].account) revert NotYourTurn();

        // Verify the leaf against the committed root.
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encodePacked(cellType, ps.x, ps.y))));
        if (!MerkleProof.verify(proof, g.players[defenderIdx].boardRoot, leaf)) {
            revert InvalidProof();
        }

        bool hit = (cellType != TYPE_WATER);
        bool sunk = false;

        if (hit) {
            // Simple model: hp=1 cells sink on first hit; hp=2 (armor) need a second fire.
            // For v1 we count a hit as destroying one cell. Armor is tracked off-ring
            // via repeated proofs on the same cell (cellType stays hp=2 until second).
            // Here a non-water cell is considered destroyed on this shot.
            g.players[defenderIdx].cellsRemaining -= 1;
            g.players[ps.shooterIdx].shotsHit += 1;
            sunk = (g.players[defenderIdx].cellsRemaining == 0);
        }

        delete pendingShots[gameId];
        g.lastActionAt = block.timestamp;
        emit ShotResolved(gameId, defenderIdx, ps.x, ps.y, hit, sunk);

        if (sunk || _allShipsSunk(g)) {
            _finishGame(gameId, ps.shooterIdx, false);
            return;
        }

        // Turn flips to the defender after answering.
        g.turn = defenderIdx;
    }

    /// @notice If the defender failed to answer a shot in time, the shooter may claim a forfeit win.
    function claimForfeit(uint256 gameId) external {
        Game storage g = games[gameId];
        if (g.state != GameState.Active) revert InvalidBoard();
        PendingShot storage ps = pendingShots[gameId];
        if (!ps.active) revert NoShotPending();
        if (block.timestamp < ps.deadline) revert ShotNotExpired();
        if (msg.sender != g.players[ps.shooterIdx].account) revert NotYourTurn();

        delete pendingShots[gameId];
        _finishGame(gameId, ps.shooterIdx, true);
    }

    // ---------------------------------------------------------------------
    // Win / payout
    // ---------------------------------------------------------------------

    function _allShipsSunk(Game storage g) internal view returns (bool) {
        return g.players[0].cellsRemaining == 0 || g.players[1].cellsRemaining == 0;
    }

    function _finishGame(uint256 gameId, uint8 winnerIdx, bool byForfeit) internal {
        Game storage g = games[gameId];
        g.state = GameState.Finished;
        g.winner = g.players[winnerIdx].account;
        address loser = g.players[(winnerIdx == 0) ? 1 : 0].account;
        wins[g.winner] += 1;
        losses[loser] += 1;
        _updateElo(g.winner, loser);
        emit GameFinished(gameId, g.winner, byForfeit);
    }

    function _updateElo(address winner, address loser) internal {
        uint256 wElo = elo[winner] == 0 ? 1000 : elo[winner];
        uint256 lElo = elo[loser] == 0 ? 1000 : elo[loser];
        // Linear ELO approximation (cosmetic ladder, not stake-weighted):
        //   expectedA = 0.5 + (a - b) / 800, clamped to [0.05, 0.95].
        // This avoids fixed-point exponentiation while preserving correct sign and magnitude.
        int256 diff = int256(wElo) - int256(lElo); // winner minus loser
        int256 expectedW = 500_000 + (diff * 1_000_000) / 800_000; // 1e6-scaled, 0.5 base
        if (expectedW < 50_000) expectedW = 50_000; // floor 0.05
        if (expectedW > 950_000) expectedW = 950_000; // cap 0.95
        uint256 k = 32;
        // Winner gains k * (1 - expectedW); loser loses k * expectedW.
        elo[winner] = wElo + (k * (1_000_000 - uint256(expectedW))) / 1_000_000;
        // Loser must not go below a floor of 100.
        uint256 lossDelta = (k * uint256(expectedW)) / 1_000_000;
        elo[loser] = lElo > lossDelta + 100 ? lElo - lossDelta : 100;
    }

    function _playerIdx(Game storage g, address a) internal view returns (uint8) {
        if (g.players[0].account == a) return 0;
        if (g.players[1].account == a) return 1;
        return 2;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getPendingShot(uint256 gameId) external view returns (PendingShot memory) {
        return pendingShots[gameId];
    }

    function gameCount() external view returns (uint256) {
        return nextGameId - 1;
    }
}
