/**
 * Minimal ABI slice the agent needs. Mirrors BattleshipGame.sol public selectors.
 * Kept inline (not imported from hardhat artifacts) so the agent package stays standalone.
 */
export const gameAbi = [
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "state", type: "uint8" },
          {
            name: "players",
            type: "tuple[2]",
            components: [
              { name: "account", type: "address" },
              { name: "boardRoot", type: "bytes32" },
              { name: "shotsHit", type: "uint8" },
              { name: "cellsRemaining", type: "uint8" },
              { name: "acknowledged", type: "bool" },
            ],
          },
          { name: "wager", type: "uint256" },
          { name: "winner", type: "address" },
          { name: "turn", type: "uint8" },
          { name: "lastActionAt", type: "uint256" },
          { name: "moveTimeout", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getPendingShot",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "active", type: "bool" },
          { name: "shooterIdx", type: "uint8" },
          { name: "x", type: "uint8" },
          { name: "y", type: "uint8" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "joinDuel",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "commitBoard",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "boardRoot", type: "bytes32" },
      { name: "cellShipCount", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "fire",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "x", type: "uint8" },
      { name: "y", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "respondShot",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "cellType", type: "uint8" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    name: "nextGameId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "botRequested",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "GameCreated",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "wager", type: "uint256", indexed: false },
    ],
  },
  {
    name: "BotRequested",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
    ],
  },
  {
    name: "OpponentJoined",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "opponent", type: "address", indexed: true },
    ],
  },
] as const;
