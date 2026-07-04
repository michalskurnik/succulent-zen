// Extracted game logic — no React, no browser APIs

const LEVELS = [
  { maxMoves: 20, pattern: [[0,1,0,1,0],[1,2,0,2,1],[0,0,3,0,0],[1,2,0,2,1],[0,1,0,1,0]] },
  { maxMoves: 20, pattern: [[1,0,2,0,1],[0,1,0,1,0],[2,0,1,0,2],[0,1,0,1,0],[1,0,2,0,1]] },
  { maxMoves: 22, pattern: [[0,0,1,0,0],[0,1,2,1,0],[1,2,0,2,1],[0,1,2,1,0],[0,0,1,0,0]] },
  { maxMoves: 22, pattern: [[0,1,0,1,0],[1,0,2,0,1],[0,2,0,2,0],[1,0,2,0,1],[0,1,0,1,0]] },
  { maxMoves: 22, pattern: [[0,0,3,0,0],[0,3,1,3,0],[3,1,0,1,3],[0,3,1,3,0],[0,0,3,0,0]] },
  { maxMoves: 24, pattern: [[1,0,0,0,1],[0,2,0,2,0],[0,0,3,0,0],[0,2,0,2,0],[1,0,0,0,1]] },
  { maxMoves: 24, pattern: [[0,1,2,1,0],[1,0,3,0,1],[2,3,0,3,2],[1,0,3,0,1],[0,1,2,1,0]] },
  { maxMoves: 25, pattern: [[2,0,1,0,2],[0,2,0,2,0],[1,0,3,0,1],[0,2,0,2,0],[2,0,1,0,2]] },
  { maxMoves: 25, pattern: [[1,2,0,2,1],[2,0,2,0,2],[0,2,3,2,0],[2,0,2,0,2],[1,2,0,2,1]] },
  { maxMoves: 28, pattern: [[0,1,2,1,0],[1,2,3,2,1],[2,3,0,3,2],[1,2,3,2,1],[0,1,2,1,0]] },
];

function fisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gridMatches(a, b) {
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      if (a[r][c] !== b[r][c]) return false;
  return true;
}

function shuffle(pattern) {
  const colored = [];
  pattern.forEach(row => row.forEach(cell => { if (cell !== 0) colored.push(cell); }));
  const positions = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) positions.push([r, c]);
  let grid, attempts = 0;
  do {
    const pos = fisherYates(positions).slice(0, colored.length);
    const col = fisherYates(colored);
    grid = Array.from({ length: 5 }, () => Array(5).fill(0));
    pos.forEach(([r, c], k) => { grid[r][c] = col[k]; });
  } while (++attempts < 20 && gridMatches(grid, pattern));
  return grid;
}

// Exact move logic from handleTile (no React state — pure functional)
function applyMove(grid, selected, r, c) {
  if (selected === null) {
    // Select phase: pick a non-empty tile
    if (grid[r][c] !== 0) {
      return { grid, selected: [r, c] };
    }
    return { grid, selected: null };
  } else {
    const [sr, sc] = selected;
    if (sr === r && sc === c) return { grid, selected: null };
    if (grid[r][c] !== 0) return { grid, selected: [r, c] };
    // Move: selected tile → empty cell
    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = newGrid[sr][sc];
    newGrid[sr][sc] = 0;
    return { grid: newGrid, selected: null };
  }
}

function checkGridIntegrity(grid, label) {
  const issues = [];
  if (!Array.isArray(grid)) {
    issues.push(`${label}: grid is not an array (got ${typeof grid})`);
    return issues;
  }
  if (grid.length !== 5) {
    issues.push(`${label}: expected 5 rows, got ${grid.length}`);
  }
  grid.forEach((row, r) => {
    if (!Array.isArray(row)) {
      issues.push(`${label}: row ${r} is not an array`);
    } else if (row.length !== 5) {
      issues.push(`${label}: row ${r} expected 5 cols, got ${row.length}`);
    } else {
      row.forEach((cell, c) => {
        if (![0, 1, 2, 3].includes(cell)) {
          issues.push(`${label}: cell [${r}][${c}] has invalid value ${cell}`);
        }
      });
    }
  });
  return issues;
}

// Pick a random valid move: first select a non-empty tile, then move it to an empty cell
function randomMoveCoords(grid, selected) {
  if (selected === null) {
    const nonEmpty = [];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++)
        if (grid[r][c] !== 0) nonEmpty.push([r, c]);
    if (nonEmpty.length === 0) return null;
    return nonEmpty[Math.floor(Math.random() * nonEmpty.length)];
  } else {
    const empty = [];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++)
        if (grid[r][c] === 0) empty.push([r, c]);
    if (empty.length === 0) return null;
    return empty[Math.floor(Math.random() * empty.length)];
  }
}

const SIMULATIONS = 100;
const MOVES_PER_SIM = 20;

let totalFailures = 0;
const levelResults = [];

for (let lvlIdx = 0; lvlIdx < LEVELS.length; lvlIdx++) {
  const level = LEVELS[lvlIdx];
  const levelNum = lvlIdx + 1;
  let failures = 0;
  const failLog = [];

  for (let sim = 0; sim < SIMULATIONS; sim++) {
    let grid = shuffle(level.pattern);
    let selected = null;
    let moveCount = 0;

    // Check initial grid
    const initIssues = checkGridIntegrity(grid, `L${levelNum} sim${sim+1} init`);
    if (initIssues.length) {
      failures++;
      failLog.push(...initIssues);
      continue;
    }

    for (let move = 0; move < MOVES_PER_SIM * 2; move++) {
      const prevRows = grid.length;
      const prevRowLens = grid.map(row => (Array.isArray(row) ? row.length : -1));

      const coords = randomMoveCoords(grid, selected);
      if (coords === null) break;

      const [r, c] = coords;
      const result = applyMove(grid, selected, r, c);
      grid = result.grid;
      selected = result.selected;

      // Only count completed moves (selected → null means a move landed)
      if (selected === null) moveCount++;

      const issues = checkGridIntegrity(grid, `L${levelNum} sim${sim+1} move${moveCount}`);
      if (issues.length) {
        failures++;
        issues.forEach(issue => {
          const rowsAfter = Array.isArray(grid) ? grid.length : '?';
          failLog.push(`Level ${levelNum} - Move ${moveCount}: grid went from ${prevRows} rows to ${rowsAfter} rows ❌  (${issue})`);
        });
        break;
      }

      // Check for row length regression
      if (Array.isArray(grid)) {
        grid.forEach((row, r2) => {
          if (Array.isArray(row) && row.length !== prevRowLens[r2] && prevRowLens[r2] !== -1) {
            failures++;
            failLog.push(`Level ${levelNum} - Move ${moveCount}: row ${r2} went from ${prevRowLens[r2]} cols to ${row.length} cols ❌`);
          }
        });
      }

      if (moveCount >= MOVES_PER_SIM) break;
    }
  }

  const status = failures === 0 ? '✅' : '❌';
  levelResults.push({ levelNum, failures, failLog });
  console.log(`Level ${levelNum}: ${SIMULATIONS} simulations × ${MOVES_PER_SIM} moves — ${failures} failures ${status}`);
  if (failLog.length > 0) {
    const shown = failLog.slice(0, 5);
    shown.forEach(msg => console.log('  ', msg));
    if (failLog.length > 5) console.log(`   ... and ${failLog.length - 5} more`);
  }

  totalFailures += failures;
}

console.log('');
console.log('══════════════════════════════════════════');
if (totalFailures === 0) {
  console.log(`PASS — all ${LEVELS.length * SIMULATIONS * MOVES_PER_SIM} move checks passed ✅`);
} else {
  console.log(`FAIL — ${totalFailures} integrity violations found ❌`);
  levelResults
    .filter(r => r.failures > 0)
    .forEach(r => console.log(`  Level ${r.levelNum}: ${r.failures} failures`));
}
console.log('══════════════════════════════════════════');
