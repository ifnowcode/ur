const boardEl = document.getElementById("board");
const rollBtn = document.getElementById("rollBtn");
const rollResultEl = document.getElementById("rollResult");
const turnInfoEl = document.getElementById("turnInfo");
const statusEl = document.getElementById("status");

// We'll model the standard Finkel-style track as linear indices 0..19
// P1 path: 0..19
// P2 path: 0..19 (same track, but their pieces are distinguished by owner)
// Rosettes at 3, 7, 13 (0-based)

// one-player mode: human = P1, AI = P2
const ONE_PLAYER = true;

const BOARD_SIZE = 20;
const PIECES_PER_PLAYER = 7;
const ROSETTES = [3, 7, 13];

let board = new Array(BOARD_SIZE).fill(null); // { owner: "P1"|"P2", id: number } or null
let offBoard = { P1: 0, P2: 0 };
let startPieces = { P1: PIECES_PER_PLAYER, P2: PIECES_PER_PLAYER }; // in hand
let currentPlayer = "P1";
let rollValue = null;
let gameOver = false;

function isRosette(i) {
  return ROSETTES.includes(i);
}

// Simple visual layout: 3 rows x 8 cols, some cells unused
// We'll map linear index 0..19 to positions in this 3x8 grid
// Common layout:
// Top row:   [ -  -  12 13 14 15 16 17 ]
// Middle:    [  0  1  2  3  4  5  6  7 ]
// Bottom:    [ -  -   8  9 10 11 18 19 ]

// layout mapping
const indexToGrid = [
  {row:1,col:0}, //0
  {row:1,col:1}, //1
  {row:1,col:2}, //2
  {row:1,col:3}, //3 rosette
  {row:1,col:4}, //4
  {row:1,col:5}, //5
  {row:1,col:6}, //6
  {row:1,col:7}, //7 rosette
  {row:2,col:2}, //8
  {row:2,col:3}, //9
  {row:2,col:4}, //10
  {row:2,col:5}, //11
  {row:0,col:2}, //12
  {row:0,col:3}, //13 rosette
  {row:0,col:4}, //14
  {row:0,col:5}, //15
  {row:0,col:6}, //16
  {row:0,col:7}, //17
  {row:2,col:6}, //18
  {row:2,col:7}, //19
];

function initBoard() {
  board = new Array(BOARD_SIZE).fill(null);
  offBoard = { P1: 0, P2: 0 };
  startPieces = { P1: PIECES_PER_PLAYER, P2: PIECES_PER_PLAYER };
  currentPlayer = "P1";
  rollValue = null;
  gameOver = false;
  rollResultEl.textContent = "Roll: -";
  statusEl.textContent = "Game started. P1 begins.";
  updateTurnInfo();
  renderBoard();
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      // find if any index maps here
      const idx = indexToGrid.findIndex(p => p.row === r && p.col === c);
      if (idx !== -1) {
        const idxLabel = document.createElement("div");
        idxLabel.className = "index";
        idxLabel.textContent = idx;
        cell.appendChild(idxLabel);

        if (isRosette(idx)) {
          cell.classList.add("rosette");
        }

        const occupant = board[idx];
        if (occupant) {
          const span = document.createElement("span");
          span.textContent = occupant.owner === "P1" ? "●" : "○";
          span.className = occupant.owner === "P1" ? "p1" : "p2";
          cell.appendChild(span);
        }

        if (!ONE_PLAYER || currentPlayer === "P1") {
          cell.addEventListener("click", () => onCellClick(idx));
        }
      }

      boardEl.appendChild(cell);
    }
  }
}

function updateTurnInfo() {
  turnInfoEl.textContent = `Turn: ${currentPlayer} | Off: P1=${offBoard.P1}, P2=${offBoard.P2}`;
}

function rollDice() {
  if (gameOver) return;
  if (ONE_PLAYER && currentPlayer === "P2") return; // human only rolls for P1

  let sum = 0;
  do {
    sum = 0;
    for (let i = 0; i < 4; i++) {
      sum += Math.random() < 0.5 ? 0 : 1;
    }
  } while (sum === 0);

  rollValue = sum;
  rollResultEl.textContent = `Roll: ${rollValue}`;
  statusEl.textContent = `You rolled ${rollValue}. Select a piece to move or bring a new one in.`;
}

function onCellClick(index) {
  if (gameOver) return;
  if (currentPlayer !== "P1" && ONE_PLAYER) return;
  if (rollValue === null) {
    statusEl.textContent = "Roll the dice first.";
    return;
  }

  handleMoveAtIndex(currentPlayer, index);
}

function handleMoveAtIndex(player, index) {
  const occupant = board[index];

  // Option 1: bring a new piece onto the board from start
  // Standard entry is at index 0 for both players

  // entry from start at index 0 with roll 1
  if (index === 0 && startPieces[player] > 0) {
    if (rollValue === 1) {
      if (!occupant) {
        board[0] = { owner: player, id: Date.now() + Math.random() };
        startPieces[player]--;
        statusEl.textContent = `${player} entered a new piece at 0.`;
        endMove(0, player);
      } else if (occupant.owner !== player && !isRosette(0)) {
        startPieces[occupant.owner]++;
        board[0] = { owner: player, id: Date.now() + Math.random() };
        startPieces[player]--;
        statusEl.textContent = `${player} captured on entry at 0.`;
        endMove(0, player);
      } else {
        statusEl.textContent = "Cannot enter: occupied by own piece or rosette.";
      }
      return;
    }
  }

  if (!occupant) {
    statusEl.textContent = "Select one of your pieces or entry square.";
    return;
  }

  if (occupant.owner !== player) {
    statusEl.textContent = "You can only move your own pieces.";
    return;
  }

  const targetIndex = index + rollValue;

  // bearing off
  if (targetIndex >= BOARD_SIZE) {
    // must be exact to bear off
    if (targetIndex === BOARD_SIZE) {
      board[index] = null;
      offBoard[player]++;
      statusEl.textContent = `${player} bore off a piece from ${index}.`;
      endMove(null, player);
    } else {
      statusEl.textContent = "You cannot move beyond the end.";
    }
    return;
  }

  const targetOccupant = board[targetIndex];

  // capture logic
  if (targetOccupant && targetOccupant.owner === player) {
    statusEl.textContent = "You cannot land on your own piece.";
    return;
  }

  if (targetOccupant && targetOccupant.owner !== player) {
    if (isRosette(targetIndex)) {
      statusEl.textContent = "Cannot capture on a rosette.";
      return;
    }
    // capture
    board[targetIndex] = occupant;
    board[index] = null;
    startPieces[targetOccupant.owner]++;
    statusEl.textContent = `${player} captured an enemy at ${targetIndex}.`;
    endMove(targetIndex, player);
    return;
  }

  // simple move
  board[targetIndex] = occupant;
  board[index] = null;
  statusEl.textContent = `${player} moved from ${index} to ${targetIndex}.`;
  endMove(targetIndex, player);
}

function endMove(finalIndex, player) {
  const extraTurn = finalIndex !== null && isRosette(finalIndex);
  rollValue = null;
  rollResultEl.textContent = "Roll: -";
  checkWin();
  if (gameOver) {
    renderBoard();
    return;
  }
  if (!extraTurn) {
    switchPlayer();
  } else {
    statusEl.textContent += " Extra turn for landing on a rosette!";
  }
  renderBoard();

  if (ONE_PLAYER && currentPlayer === "P2" && !gameOver) {
    setTimeout(aiTurn, 600);
  }
}

function switchPlayer() {
  currentPlayer = currentPlayer === "P1" ? "P2" : "P1";
  updateTurnInfo();
}

function checkWin() {
  if (offBoard.P1 >= PIECES_PER_PLAYER) {
    statusEl.textContent = "Player 1 has borne off all pieces and wins!";
    gameOver = true;
  } else if (offBoard.P2 >= PIECES_PER_PLAYER) {
    statusEl.textContent = "Player 2 has borne off all pieces and wins!";
    gameOver = true;
  }
}

// ─────────────────────────────
// AI SECTION (P2)
// ─────────────────────────────

function aiRoll() {
  let sum = 0;
  do {
    sum = 0;
    for (let i = 0; i < 4; i++) {
      sum += Math.random() < 0.5 ? 0 : 1;
    }
  } while (sum === 0);
  return sum;
}

function aiTurn() {
  if (gameOver || currentPlayer !== "P2") return;

  rollValue = aiRoll();
  rollResultEl.textContent = `Roll: ${rollValue}`;
  statusEl.textContent = `AI rolled ${rollValue}. Thinking...`;

  const action = aiChooseAction("P2", rollValue);
  if (!action) {
    statusEl.textContent = `AI has no legal moves. Turn passes.`;
    rollValue = null;
    switchPlayer();
    renderBoard();
    return;
  }

  if (action.type === "enter") {
    handleMoveAtIndex("P2", 0);
  } else if (action.type === "move") {
    handleMoveAtIndex("P2", action.from);
  }
}

function aiChooseAction(player, roll) {
  const moves = [];

  // option: enter from start at 0 with roll 1
  if (roll === 1 && startPieces[player] > 0) {
    const occ = board[0];
    if (!occ || (occ.owner !== player && !isRosette(0))) {
      moves.push({ type: "enter", score: aiScoreEnter(player) });
    }
  }

  // moves for existing pieces
  for (let i = 0; i < BOARD_SIZE; i++) {
    const u = board[i];
    if (!u || u.owner !== player) continue;

    const targetIndex = i + roll;

    // bearing off
    if (targetIndex === BOARD_SIZE) {
      moves.push({ type: "move", from: i, score: 100 });
      continue;
    }
    if (targetIndex > BOARD_SIZE) continue;

    const targetOcc = board[targetIndex];

    if (targetOcc && targetOcc.owner === player) continue;

    if (targetOcc && targetOcc.owner !== player) {
      if (isRosette(targetIndex)) continue;
      moves.push({ type: "move", from: i, score: 80 });
      continue;
    }

    let score = 10;
    if (isRosette(targetIndex)) score += 20;
    score += targetIndex * 0.5;
    moves.push({ type: "move", from: i, score });
  }

  if (moves.length === 0) return null;

  moves.sort((a, b) => b.score - a.score);
  return moves[0];
}

function aiScoreEnter(player) {
  const occ = board[0];
  if (!occ) return 15;
  if (occ.owner !== player && !isRosette(0)) return 50;
  return 0;
}

rollBtn.addEventListener("click", rollDice);

initBoard();
