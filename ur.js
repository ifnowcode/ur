const boardEl = document.getElementById("board");
const rollBtn = document.getElementById("rollBtn");
const rollResultEl = document.getElementById("rollResult");
const turnInfoEl = document.getElementById("turnInfo");
const statusEl = document.getElementById("status");

// We'll model the standard Finkel-style track as linear indices 0..19
// P1 path: 0..19
// P2 path: 0..19 (same track, but their pieces are distinguished by owner)
// Rosettes at 3, 7, 13 (0-based)
const BOARD_SIZE = 20;
const PIECES_PER_PLAYER = 7;
const ROSETTES = [3, 7, 13];

let board = new Array(BOARD_SIZE).fill(null); // { owner: "P1"|"P2", id: number } or null
let offBoard = { P1: 0, P2: 0 }; // borne off counts
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
        const displayIndex = idx;
        const idxLabel = document.createElement("div");
        idxLabel.className = "index";
        idxLabel.textContent = displayIndex;
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

        cell.addEventListener("click", () => onCellClick(idx));
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
  if (rollValue === null) {
    statusEl.textContent = "Roll the dice first.";
    return;
  }

  const occupant = board[index];

  // Option 1: bring a new piece onto the board from start
  // Standard entry is at index 0 for both players
  if (index === 0 && startPieces[currentPlayer] > 0) {
    if (rollValue === 1) {
      if (!occupant) {
        board[0] = { owner: currentPlayer, id: Date.now() };
        startPieces[currentPlayer]--;
        statusEl.textContent = `${currentPlayer} entered a new piece at 0.`;
        endMove(0);
      } else if (occupant.owner !== currentPlayer && !isRosette(0)) {
        // capture on entry (rare but possible)
        startPieces[occupant.owner]++; // send back to start pool
        board[0] = { owner: currentPlayer, id: Date.now() };
        startPieces[currentPlayer]--;
        statusEl.textContent = `${currentPlayer} captured on entry at 0.`;
        endMove(0);
      } else {
        statusEl.textContent = "Cannot enter: occupied by own piece or rosette.";
      }
      return;
    }
  }

  // Option 2: move an existing piece
  if (!occupant) {
    statusEl.textContent = "Select one of your pieces or entry square.";
    return;
  }

  if (occupant.owner !== currentPlayer) {
    statusEl.textContent = "You can only move your own pieces.";
    return;
  }

  const targetIndex = index + rollValue;

  // bearing off
  if (targetIndex >= BOARD_SIZE) {
    // must be exact to bear off
    if (targetIndex === BOARD_SIZE) {
      board[index] = null;
      offBoard[currentPlayer]++;
      statusEl.textContent = `${currentPlayer} bore off a piece from ${index}.`;
      endMove(null);
    } else {
      statusEl.textContent = "You cannot move beyond the end.";
    }
    return;
  }

  const targetOccupant = board[targetIndex];

  if (targetOccupant && targetOccupant.owner === currentPlayer) {
    statusEl.textContent = "You cannot land on your own piece.";
    return;
  }

  // capture logic
  if (targetOccupant && targetOccupant.owner !== currentPlayer) {
    if (isRosette(targetIndex)) {
      statusEl.textContent = "Cannot capture on a rosette.";
      return;
    }
    // capture
    board[targetIndex] = occupant;
    board[index] = null;
    startPieces[targetOccupant.owner]++; // send captured piece back to start pool
    statusEl.textContent = `${currentPlayer} captured an enemy at ${targetIndex}.`;
    endMove(targetIndex);
    return;
  }

  // simple move
  board[targetIndex] = occupant;
  board[index] = null;
  statusEl.textContent = `${currentPlayer} moved from ${index} to ${targetIndex}.`;
  endMove(targetIndex);
}

function endMove(finalIndex) {
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

rollBtn.addEventListener("click", rollDice);

initBoard();
