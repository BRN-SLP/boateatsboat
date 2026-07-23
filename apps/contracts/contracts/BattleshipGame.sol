// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BattleshipGame
/// @notice BoatEatsBoat bathtub battleship. Merkle-commit / fire / proof / claim.
/// @dev Board is 10x10. Each cell is a leaf: keccak256(abi.encodePacked(cellType, salt)).
///      cellType encodes ship id + hp + stealth flags. Cell type 0 = water.
contract BattleshipGame is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeERC20 for IERC20;
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
    // Monotonic nonce used to derive unpredictable game ids. The id itself is a
    // hash, not the nonce, so players cannot enumerate other people's duels.
    uint256 public gameNonce;

    // Free duels are not joined by the bot unless the creator explicitly
    // requests it. Wagered duels never get a bot. This lets a player start a
    // free "vs friend" duel and share the id without the bot snatching it.
    mapping(uint256 => bool) public botRequested;

    // cUSD (or any ERC-20) used for wagers and tournament entry fees. Set at init.
    IERC20 public paymentToken;

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

    // Armor tracking: how many confirmed hits each cell of a defender has absorbed.
    // Keyed by (gameId, defenderIdx, cellIndex). Battleship (hp=2) needs 2 hits to sink.
    mapping(uint256 => mapping(uint8 => mapping(uint16 => uint8))) public cellHits;

    // ---------------------------------------------------------------------
    // Tournaments
    // ---------------------------------------------------------------------

    enum PayoutScheme {
        WinnerTakesAll,
        Top3
    }

    enum TournamentState {
        Registration,
        Active,
        Finished
    }

    struct Tournament {
        address creator;
        uint256 entryFee; // cUSD per player, 0 = free
        uint8 maxPlayers; // cap; must be power of 2
        uint8 rounds; // log2(maxPlayers)
        uint256 regDeadline;
        PayoutScheme scheme;
        TournamentState state;
        address[] registrants;
        // bracket[round][slot] = gameId of the duel at that position; 0 = TBD.
        mapping(uint8 => mapping(uint16 => uint256)) bracket;
        // Winners tree: round -> slot -> address (filled as rounds complete).
        mapping(uint8 => mapping(uint16 => address)) slotWinner;
        uint256 prizePool; // accumulated entry fees
        address firstPlace; // set on finish
        address secondPlace;
        address thirdPlace;
        bool prizesClaimed;
    }

    mapping(uint256 => Tournament) private tournaments;
    uint256 public nextTournamentId;
    // gameId -> tournamentId (0 if not part of a tournament)
    mapping(uint256 => uint256) public gameTournament;
    // gameId -> (round, slot) within its tournament
    mapping(uint256 => uint16) public gameSlot;
    mapping(uint256 => uint8) public gameRound;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 wager);
    event OpponentJoined(uint256 indexed gameId, address indexed opponent);
    // Emitted when a duel creator asks the off-chain bot to auto-join.
    event BotRequested(uint256 indexed gameId);
    event BoardCommitted(uint256 indexed gameId, uint8 indexed playerIdx);
    event GameStarted(uint256 indexed gameId, uint8 firstTurn);
    event ShotFired(uint256 indexed gameId, uint8 indexed shooterIdx, uint8 x, uint8 y);
    event ShotResolved(
        uint256 indexed gameId,
        uint8 indexed defenderIdx,
        uint8 x,
        uint8 y,
        uint8 cellType,
        bool hit,
        bool armored,
        bool stealth,
        bool sunk,
        bool cellDestroyed
    );
    event GameFinished(uint256 indexed gameId, address indexed winner, bool byForfeit);
    event WagerClaimed(uint256 indexed gameId, address indexed winner, uint256 amount);

    event TournamentCreated(uint256 indexed tournamentId, address indexed creator, uint256 entryFee, uint8 maxPlayers, PayoutScheme scheme);
    event TournamentRegistered(uint256 indexed tournamentId, address indexed player);
    event TournamentStarted(uint256 indexed tournamentId, uint8 rounds);
    event TournamentRoundResolved(uint256 indexed tournamentId, uint8 round, uint16 slot, address winner);
    event TournamentFinished(uint256 indexed tournamentId, address first, address second, address third);
    event TournamentPrizeClaimed(uint256 indexed tournamentId, address indexed claimant, uint256 amount);

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
    // Tournament errors
    error TournamentFull();
    error TournamentNotOpen();
    error RegistrationClosed();
    error NotEnoughPlayers();
    error NotPowerOfTwo();
    error OnlyTournamentCreator();
    error TournamentGameNotResolved();
    error InvalidSlot();
    error PrizesAlreadyClaimed();
    error NotATournamentWinner();

    // ---------------------------------------------------------------------
    // Initializer
    // ---------------------------------------------------------------------

    /// @custom:oz-upgrades-validate-as-initializer
    /// @param _paymentToken cUSD (or any ERC-20) address for wagers and entry fees.
    function initialize(address _paymentToken) public virtual initializer {
        __Ownable_init(msg.sender);
        gameNonce = 0;
        nextTournamentId = 1;
        paymentToken = IERC20(_paymentToken);
    }

    /// @dev Derive a fresh, unpredictable, non-zero game id. Uses block.prevrandao
    ///      (available on Celo PoS) mixed with the caller and a monotonic nonce so
    ///      that ids cannot be enumerated in order by third parties.
    function _newGameId() internal returns (uint256 id) {
        gameNonce++;
        id = uint256(
            keccak256(abi.encodePacked(msg.sender, block.prevrandao, gameNonce, block.timestamp))
        );
        // Ensure non-zero (games[0] stays an empty sentinel).
        if (id == 0) id = 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Owner can update the payment token (e.g. switch stablecoin per chain).
    function setPaymentToken(address _paymentToken) external onlyOwner {
        paymentToken = IERC20(_paymentToken);
    }

    // ---------------------------------------------------------------------
    // Game lifecycle (Duel)
    // ---------------------------------------------------------------------

    /// @notice Create a new duel with an optional cUSD wager. Caller is player 0.
    /// Wager is escrowed into the contract on creation.
    function createDuel(uint256 wager) external returns (uint256 gameId) {
        gameId = _newGameId();
        Game storage g = games[gameId];
        g.state = GameState.Open;
        g.players[0].account = msg.sender;
        g.wager = wager;
        g.lastActionAt = block.timestamp;
        g.moveTimeout = 24 hours;
        if (wager > 0) {
            paymentToken.safeTransferFrom(msg.sender, address(this), wager);
        }
        emit GameCreated(gameId, msg.sender, wager);
    }

    /// @notice Join an open duel as player 1. Wager matched via cUSD transferFrom.
    function joinDuel(uint256 gameId) external {
        Game storage g = games[gameId];
        if (g.state != GameState.Open) revert InvalidBoard();
        if (g.wager > 0) {
            paymentToken.safeTransferFrom(msg.sender, address(this), g.wager);
        }
        g.players[1].account = msg.sender;
        g.state = GameState.Placing;
        g.lastActionAt = block.timestamp;
        emit OpponentJoined(gameId, msg.sender);
    }

    /// @notice The duel creator asks the off-chain bot to auto-join this free duel.
    /// Only callable by player 0 while the duel is still Open and free.
    function requestBot(uint256 gameId) external {
        Game storage g = games[gameId];
        if (g.state != GameState.Open) revert InvalidBoard();
        if (msg.sender != g.players[0].account) revert NotParticipant();
        if (g.wager > 0) revert WagerMismatch();
        botRequested[gameId] = true;
        emit BotRequested(gameId);
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
        bool armored = (cellType >= TYPE_SHIP_HP2 && cellType < TYPE_SUB_STEALTH);
        bool stealth = _isStealth(cellType);
        bool sunk = false;
        // Whether THIS shot destroyed the targeted cell. Drives the
        // "hit again" turn rule: a shooter who destroys a cell keeps the turn.
        bool cellDestroyed = false;

        if (hit) {
            uint16 cellIndex = uint16(uint16(ps.y) * BOARD_SIZE + ps.x);
            uint8 hp = _cellHp(cellType);
            uint8 already = cellHits[gameId][defenderIdx][cellIndex];
            if (already + 1 >= hp) {
                // Cell destroyed. Only now does it leave the defender's remaining count.
                g.players[defenderIdx].cellsRemaining -= 1;
                cellDestroyed = true;
                sunk = (g.players[defenderIdx].cellsRemaining == 0);
            } else {
                // Armored cell wounded but not yet destroyed; remember the hit.
                cellHits[gameId][defenderIdx][cellIndex] = already + 1;
            }
            g.players[ps.shooterIdx].shotsHit += 1;
        }

        // Cache pending-shot fields BEFORE delete — once pendingShots[gameId] is
        // zeroed, the `ps` storage pointer reads back 0 for every field, which
        // would corrupt the ShotResolved event (x/y always emit as 0) and the
        // shooter index used to finish the game.
        uint8 shotX = ps.x;
        uint8 shotY = ps.y;
        uint8 shooterIdx = ps.shooterIdx;

        delete pendingShots[gameId];
        g.lastActionAt = block.timestamp;
        emit ShotResolved(gameId, defenderIdx, shotX, shotY, cellType, hit, armored, stealth, sunk, cellDestroyed);

        if (sunk || _allShipsSunk(g)) {
            _finishGame(gameId, shooterIdx, false);
            return;
        }

        // Turn rule (classic Battleship): a shooter who DESTROYS a cell keeps
        // the turn and fires again. A miss, or a hit that only wounds an armored
        // cell (not yet destroyed), passes the turn to the defender.
        // cellDestroyed is true only when this shot reduced cellsRemaining.
        if (cellDestroyed) {
            g.turn = shooterIdx;
        } else {
            g.turn = defenderIdx;
        }
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

        // Payout wager: winner takes both stakes. Tournament games payout via the tournament.
        uint256 tid = gameTournament[gameId];
        if (g.wager > 0 && tid == 0) {
            uint256 payout = g.wager * 2;
            paymentToken.safeTransfer(g.winner, payout);
            emit WagerClaimed(gameId, g.winner, payout);
        }

        emit GameFinished(gameId, g.winner, byForfeit);

        // If this game belongs to a tournament, advance the bracket.
        if (tid != 0) {
            _advanceTournament(tid, gameId);
        }
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
        return gameNonce;
    }

    // ---------------------------------------------------------------------
    // Tournaments
    // ---------------------------------------------------------------------

    /// @notice Create a tournament. maxPlayers must be a power of 2 (8/16/32/64).
    function createTournament(
        uint256 entryFee,
        uint8 maxPlayers,
        uint256 regDeadline,
        PayoutScheme scheme
    ) external returns (uint256 tid) {
        if (maxPlayers < 2) revert NotPowerOfTwo();
        // Power-of-two check.
        if (maxPlayers & (maxPlayers - 1) != 0) revert NotPowerOfTwo();
        tid = nextTournamentId++;
        Tournament storage t = tournaments[tid];
        t.creator = msg.sender;
        t.entryFee = entryFee;
        t.maxPlayers = maxPlayers;
        t.rounds = _log2(maxPlayers);
        t.regDeadline = regDeadline;
        t.scheme = scheme;
        t.state = TournamentState.Registration;
        emit TournamentCreated(tid, msg.sender, entryFee, maxPlayers, scheme);
    }

    /// @notice Register for a tournament. Escrows entryFee in cUSD.
    function registerForTournament(uint256 tid) external {
        Tournament storage t = tournaments[tid];
        if (t.state != TournamentState.Registration) revert TournamentNotOpen();
        if (block.timestamp > t.regDeadline) revert RegistrationClosed();
        if (t.registrants.length >= t.maxPlayers) revert TournamentFull();
        if (t.entryFee > 0) {
            paymentToken.safeTransferFrom(msg.sender, address(this), t.entryFee);
            t.prizePool += t.entryFee;
        }
        t.registrants.push(msg.sender);
        emit TournamentRegistered(tid, msg.sender);
    }

    /// @notice Creator seeds the bracket after registration closes. BYEs fill odd slots.
    function startTournament(uint256 tid) external {
        Tournament storage t = tournaments[tid];
        if (msg.sender != t.creator) revert OnlyTournamentCreator();
        if (t.state != TournamentState.Registration) revert TournamentNotOpen();
        if (t.registrants.length < 2) revert NotEnoughPlayers();
        // Round up registrants to next power of two by padding with address(0) (BYE).
        uint8 size = _nextPow2(uint8(t.registrants.length));
        if (size > t.maxPlayers) size = t.maxPlayers;
        for (uint16 i = 0; i < size; i++) {
            address p = i < t.registrants.length ? t.registrants[i] : address(0);
            t.slotWinner[0][i] = p;
        }
        t.state = TournamentState.Active;
        emit TournamentStarted(tid, t.rounds);
        _pairNextRound(tid, 0, size);
    }

    /// @dev Pair adjacent winners of the previous round into duels for the next round.
    function _pairNextRound(uint256 tid, uint8 round, uint16 slots) internal {
        Tournament storage t = tournaments[tid];
        for (uint16 slot = 0; slot + 1 < slots; slot += 2) {
            address a = t.slotWinner[round][slot];
            address b = t.slotWinner[round][slot + 1];
            if (a == address(0) && b == address(0)) {
                // Both empty (shouldn't happen at round 0, but guard anyway).
                continue;
            }
            if (a == address(0)) {
                // BYE: b auto-advances.
                t.slotWinner[round + 1][slot / 2] = b;
                emit TournamentRoundResolved(tid, round, slot, b);
                continue;
            }
            if (b == address(0)) {
                t.slotWinner[round + 1][slot / 2] = a;
                emit TournamentRoundResolved(tid, round, slot, a);
                continue;
            }
            // Create a tournament duel: free (entry fee already escrowed).
            uint256 gameId = _newGameId();
            Game storage g = games[gameId];
            g.state = GameState.Placing; // skip Open; both players known
            g.players[0].account = a;
            g.players[1].account = b;
            g.lastActionAt = block.timestamp;
            g.moveTimeout = 24 hours;
            gameTournament[gameId] = tid;
            gameRound[gameId] = round;
            gameSlot[gameId] = slot;
            t.bracket[round][slot] = gameId;
            emit GameCreated(gameId, a, 0);
        }
    }

    /// @dev Called from _finishGame when a tournament game completes. Advances winner.
    function _advanceTournament(uint256 tid, uint256 gameId) internal {
        Tournament storage t = tournaments[tid];
        if (t.state != TournamentState.Active) return;
        uint8 round = gameRound[gameId];
        uint16 slot = gameSlot[gameId];
        address winner = games[gameId].winner;
        if (winner == address(0)) return;
        t.slotWinner[round + 1][slot / 2] = winner;
        emit TournamentRoundResolved(tid, round, slot, winner);

        // Count resolved slots in the current round.
        uint16 slotsThisRound = t.maxPlayers >> round;
        bool roundComplete = true;
        for (uint16 s = 0; s + 1 < slotsThisRound; s += 2) {
            if (
                t.bracket[round][s] != 0 && games[t.bracket[round][s]].state != GameState.Finished
            ) {
                roundComplete = false;
                break;
            }
            if (
                t.bracket[round][s + 1] != 0 &&
                games[t.bracket[round][s + 1]].state != GameState.Finished
            ) {
                roundComplete = false;
                break;
            }
        }
        if (!roundComplete) return;

        // Was this the final round?
        if (round + 1 >= t.rounds) {
            _finishTournament(tid);
            return;
        }
        // Pair the next round using the freshly populated slotWinner[round+1].
        uint16 nextSlots = slotsThisRound / 2;
        _pairNextRound(tid, round + 1, nextSlots * 2);
    }

    function _finishTournament(uint256 tid) internal {
        Tournament storage t = tournaments[tid];
        t.state = TournamentState.Finished;
        address champ = t.slotWinner[t.rounds][0];
        t.firstPlace = champ;
        // secondPlace = loser of the final. We can derive from the final game.
        // thirdPlace = best loser of semifinals (skip rigorous 3rd-place match for gas).
        address second = address(0);
        address third = address(0);
        // Final game is bracket[rounds-1][0].
        uint256 finalGame = t.bracket[t.rounds - 1][0];
        if (finalGame != 0) {
            Game storage fg = games[finalGame];
            second = fg.winner == fg.players[0].account ? fg.players[1].account : fg.players[0].account;
        }
        if (t.rounds >= 2) {
            // Semifinals losers (two slots at round rounds-2).
            uint8 sf = t.rounds - 2;
            uint256 g0 = t.bracket[sf][0];
            uint256 g1 = t.bracket[sf][1];
            if (g0 != 0) {
                Game storage sg = games[g0];
                third = sg.winner == sg.players[0].account ? sg.players[1].account : sg.players[0].account;
            }
            // Prefer the semifinalist that lasted longer if both present; we keep first for simplicity.
            (g1); // explicit no-op to silence unused warning
        }
        t.secondPlace = second;
        t.thirdPlace = third;
        emit TournamentFinished(tid, champ, second, third);
    }

    /// @notice Winner claims their share of the prize pool per the payout scheme.
    function claimTournamentPrize(uint256 tid) external {
        Tournament storage t = tournaments[tid];
        if (t.state != TournamentState.Finished) revert GameNotFinished();
        if (t.prizesClaimed) revert PrizesAlreadyClaimed();
        if (t.prizePool == 0) {
            t.prizesClaimed = true;
            return;
        }
        address first = t.firstPlace;
        address second = t.secondPlace;
        address third = t.thirdPlace;
        if (t.scheme == PayoutScheme.Top3 && third != address(0)) {
            uint256 firstShare = (t.prizePool * 70) / 100;
            uint256 secondShare = (t.prizePool * 20) / 100;
            uint256 thirdShare = t.prizePool - firstShare - secondShare; // remainder = 10%
            paymentToken.safeTransfer(first, firstShare);
            paymentToken.safeTransfer(second, secondShare);
            paymentToken.safeTransfer(third, thirdShare);
            emit TournamentPrizeClaimed(tid, first, firstShare);
        } else {
            paymentToken.safeTransfer(first, t.prizePool);
            emit TournamentPrizeClaimed(tid, first, t.prizePool);
        }
        t.prizesClaimed = true;
    }

    // ---------------------------------------------------------------------
    // Tournament views
    // ---------------------------------------------------------------------

    function getTournamentRegistrants(uint256 tid) external view returns (address[] memory) {
        return tournaments[tid].registrants;
    }

    function getTournamentInfo(uint256 tid)
        external
        view
        returns (
            address creator,
            uint256 entryFee,
            uint8 maxPlayers,
            uint8 rounds,
            PayoutScheme scheme,
            TournamentState state,
            uint256 prizePool,
            address firstPlace,
            address secondPlace,
            address thirdPlace
        )
    {
        Tournament storage t = tournaments[tid];
        return (
            t.creator,
            t.entryFee,
            t.maxPlayers,
            t.rounds,
            t.scheme,
            t.state,
            t.prizePool,
            t.firstPlace,
            t.secondPlace,
            t.thirdPlace
        );
    }

    function getTournamentSlotWinner(uint256 tid, uint8 round, uint16 slot)
        external
        view
        returns (address)
    {
        return tournaments[tid].slotWinner[round][slot];
    }

    function tournamentCount() external view returns (uint256) {
        return nextTournamentId - 1;
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _log2(uint8 n) internal pure returns (uint8) {
        uint8 r = 0;
        while (n > 1) {
            n >>= 1;
            r++;
        }
        return r;
    }

    function _nextPow2(uint8 n) internal pure returns (uint8) {
        if (n <= 1) return 1;
        n--;
        n |= n >> 1;
        n |= n >> 2;
        n |= n >> 4;
        return n + 1;
    }
}
