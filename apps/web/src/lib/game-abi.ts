// Minimal BattleshipGame ABI for the web client. Mirrors the contract + agent ABI.

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
    name: "createDuel",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "wager", type: "uint256" }],
    outputs: [{ name: "gameId", type: "uint256" }],
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
    name: "claimForfeit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
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
    name: "requestBot",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "botRequested",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "elo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "wins",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint32" }],
  },
] as const;
