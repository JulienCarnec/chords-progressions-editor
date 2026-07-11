/**
 * Default built-in pattern definitions.
 * Uses the new visual grid format: { id, name, loop, columns, subPatterns: { 3, 4, 5 } }
 *
 * Grid format: grid[colIndex][rowIndex] = 'off' | 'sustain' | 'staccato'
 * Row layout for noteCount N (top → bottom):
 *   octave 2: letters N-1 down to 0  (e.g. for N=3: c2, b2, a2)
 *   octave 1: letters N-1 down to 0  (e.g. for N=3: c1, b1, a1)
 *   octave 0: letters N-1 down to 0  (e.g. for N=3: c0, b0, a0)
 *
 * rowIndex(letter, octave, noteCount):
 *   letterIdx = letter.charCodeAt(0) - 97  (a=0, b=1, c=2, d=3, e=4)
 *   rowIdx = (2 - octave) * noteCount + (noteCount - 1 - letterIdx)
 */

// ─── Builder helpers ──────────────────────────────────────────────────────────

function rowIdx(letter, octave, noteCount) {
  const letterIdx = letter.charCodeAt(0) - 97;
  return (2 - octave) * noteCount + (noteCount - 1 - letterIdx);
}

/**
 * Build a grid with given number of columns and noteCount.
 * active: array of { col, tokens: [{ letter, octave, staccato? }] }
 */
function buildGrid(numCols, noteCount, active) {
  const numRows = noteCount * 3;
  const grid = Array.from({ length: numCols }, () => Array(numRows).fill('off'));
  for (const { col, tokens } of active) {
    if (col < 0 || col >= numCols) continue;
    for (const { letter, octave, staccato } of tokens) {
      const r = rowIdx(letter, octave, noteCount);
      if (r >= 0 && r < numRows) {
        grid[col][r] = staccato ? 'staccato' : 'sustain';
      }
    }
  }
  return grid;
}

/** Shorthand: build active entry for a column with all chord notes at given octave. */
function allNotes(col, octave, noteCount, staccato = false) {
  const tokens = [];
  for (let i = 0; i < noteCount; i++) {
    tokens.push({ letter: String.fromCharCode(97 + i), octave, staccato });
  }
  return { col, tokens };
}

/** Single note token helper */
function note(col, letter, octave, staccato = false) {
  return { col, tokens: [{ letter, octave, staccato }] };
}

/**
 * Fill trailing empty columns of a grid by repeating (cycling) the active
 * columns from the beginning.
 * @param {Array} grid     – the grid to mutate in-place (grid[colIdx][rowIdx])
 * @param {number} activeCols – how many leading columns carry real notes
 */
function wrapFill(grid, activeCols) {
  const totalCols = grid.length;
  for (let ci = activeCols; ci < totalCols; ci++) {
    const srcCol = ci % activeCols;
    grid[ci] = [...grid[srcCol]];
  }
  return grid;
}

// ─── Pattern definitions ──────────────────────────────────────────────────────

/**
 * Block chord — all notes sustain together, 1 column
 */
function makeBlockChord() {
  function makeGrid(noteCount) {
    return buildGrid(1, noteCount, [allNotes(0, 1, noteCount)]);
  }
  return {
    id: 'builtin-block',
    name: 'Block chord',
    loop: true,
    columns: ['4n'],
    subPatterns: { 3: makeGrid(3), 4: makeGrid(4), 5: makeGrid(5) },
  };
}

/**
 * Reggae up-beat — bass on beat 1, muted chord on beat 2, rest on beat 3, muted chord on beat 4
 * Pattern: bass(0), chord.(1), rest(2), chord.(3)  — 4 cols of 4n
 */
function makeReggaeUpBeat() {
  function makeGrid(noteCount) {
    return buildGrid(4, noteCount, [
      note(0, 'a', 0),                           // bass note (lowest, oct below)
      allNotes(1, 1, noteCount, true),           // chord staccato
      // col 2 = rest
      allNotes(3, 1, noteCount, true),           // chord staccato
    ]);
  }
  return {
    id: 'builtin-reggae',
    name: 'Reggae up-beat',
    loop: false,
    columns: ['4n', '4n', '4n', '4n'],
    subPatterns: { 3: makeGrid(3), 4: makeGrid(4), 5: makeGrid(5) },
  };
}

/**
 * Prelude arpeggio (Bach style) — bass open fifth, then rolling through chord notes
 * 8 steps of 8n. All sub-patterns: a0, c0, then 3-note rolling figure × 2
 */
function makePreludeArpegio() {
  // 3-note: a0, c0, a1, b1, c1, a1, b1, c1
  // 4-note: a0, c0, a1, c1, d1, a1, c1, d1
  // 5-note: a0, c0, a1, c1, e1, a1, c1, e1
  function makeGrid3() {
    return buildGrid(8, 3, [
      note(0, 'a', 0),
      note(1, 'c', 0),
      note(2, 'a', 1),
      note(3, 'b', 1),
      note(4, 'c', 1),
      note(5, 'a', 1),
      note(6, 'b', 1),
      note(7, 'c', 1),
    ]);
  }
  function makeGrid4() {
    return buildGrid(8, 4, [
      note(0, 'a', 0),
      note(1, 'c', 0),
      note(2, 'a', 1),
      note(3, 'c', 1),
      note(4, 'd', 1),
      note(5, 'a', 1),
      note(6, 'c', 1),
      note(7, 'd', 1),
    ]);
  }
  function makeGrid5() {
    return buildGrid(8, 5, [
      note(0, 'a', 0),
      note(1, 'c', 0),
      note(2, 'a', 1),
      note(3, 'c', 1),
      note(4, 'e', 1),
      note(5, 'a', 1),
      note(6, 'c', 1),
      note(7, 'e', 1),
    ]);
  }
  return {
    id: 'builtin-prelude-arp',
    name: 'Prelude arpeggio',
    loop: true,
    columns: ['8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n'],
    subPatterns: { 3: makeGrid3(), 4: makeGrid4(), 5: makeGrid5() },
  };
}

/**
 * Buckley arpeggio — bass+root, up, skip, return
 * Pattern: [a0,c0], a1, b1, [c1,d1], b1, c1
 */
function makeBuckleyArpegio() {
  function makeGrid3() {
    return buildGrid(6, 3, [
      { col: 0, tokens: [{ letter: 'a', octave: 0 }, { letter: 'c', octave: 0 }] },
      note(1, 'a', 1),
      note(2, 'b', 1),
      note(3, 'c', 1),
      note(4, 'b', 1),
      note(5, 'c', 1),
    ]);
  }
  function makeGrid4() {
    return buildGrid(6, 4, [
      { col: 0, tokens: [{ letter: 'a', octave: 0 }, { letter: 'd', octave: 0 }] },
      note(1, 'a', 1),
      note(2, 'b', 1),
      note(3, 'c', 1),
      note(4, 'd', 1),
      note(5, 'b', 1),
    ]);
  }
  function makeGrid5() {
    return buildGrid(6, 5, [
      { col: 0, tokens: [{ letter: 'a', octave: 0 }, { letter: 'e', octave: 0 }] },
      note(1, 'a', 1),
      note(2, 'b', 1),
      note(3, 'c', 1),
      note(4, 'd', 1),
      note(5, 'e', 1),
    ]);
  }
  return {
    id: 'builtin-buckley',
    name: 'Buckley arpeggio',
    loop: true,
    columns: ['8n', '8n', '8n', '8n', '8n', '8n'],
    subPatterns: { 3: makeGrid3(), 4: makeGrid4(), 5: makeGrid5() },
  };
}

/**
 * Arpeggio up 1 octave — ascending through all notes in octave 1.
 * 5 columns total; smaller sub-patterns wrap-fill from column 0.
 */
function makeArpUp1Oct() {
  const TOTAL_COLS = 5;
  function makeGrid(noteCount) {
    const active = [];
    for (let i = 0; i < noteCount; i++) {
      active.push(note(i, String.fromCharCode(97 + i), 1));
    }
    // Build with full 5 columns so the grid fits the shared columns array,
    // then wrap-fill trailing empty columns from the beginning.
    return wrapFill(buildGrid(TOTAL_COLS, noteCount, active), noteCount);
  }
  return {
    id: 'builtin-arp-up-1oct',
    name: 'Arpeggio up 1 oct',
    loop: true,
    columns: Array(TOTAL_COLS).fill('8n'),
    subPatterns: { 3: makeGrid(3), 4: makeGrid(4), 5: makeGrid(5) },
  };
}

/**
 * Arpeggio down 1 octave — descending through all notes in octave 1.
 * 5 columns total; smaller sub-patterns wrap-fill from column 0.
 */
function makeArpDown1Oct() {
  const TOTAL_COLS = 5;
  function makeGrid(noteCount) {
    const active = [];
    for (let i = noteCount - 1; i >= 0; i--) {
      active.push(note(noteCount - 1 - i, String.fromCharCode(97 + i), 1));
    }
    return wrapFill(buildGrid(TOTAL_COLS, noteCount, active), noteCount);
  }
  return {
    id: 'builtin-arp-down-1oct',
    name: 'Arpeggio down 1 oct',
    loop: true,
    columns: Array(TOTAL_COLS).fill('8n'),
    subPatterns: { 3: makeGrid(3), 4: makeGrid(4), 5: makeGrid(5) },
  };
}

/**
 * Arpeggio up 2 octaves — ascending oct 1 then oct 2.
 * 10 columns total; smaller sub-patterns wrap-fill trailing columns.
 */
function makeArpUp2Oct() {
  const TOTAL_COLS = 10;
  function makeGrid(noteCount) {
    const active = [];
    for (let i = 0; i < noteCount; i++) {
      active.push(note(i, String.fromCharCode(97 + i), 1));
    }
    for (let i = 0; i < noteCount; i++) {
      active.push(note(noteCount + i, String.fromCharCode(97 + i), 2));
    }
    const activeCols = noteCount * 2;
    return wrapFill(buildGrid(TOTAL_COLS, noteCount, active), activeCols);
  }
  return {
    id: 'builtin-arp-up-2oct',
    name: 'Arpeggio up 2 oct',
    loop: true,
    columns: Array(TOTAL_COLS).fill('8n'),
    subPatterns: { 3: makeGrid(3), 4: makeGrid(4), 5: makeGrid(5) },
  };
}

/**
 * Arpeggio down 2 octaves — descending oct 2 then oct 1.
 * 10 columns total; smaller sub-patterns wrap-fill trailing columns.
 */
function makeArpDown2Oct() {
  const TOTAL_COLS = 10;
  function makeGrid(noteCount) {
    const active = [];
    for (let i = noteCount - 1; i >= 0; i--) {
      active.push(note(noteCount - 1 - i, String.fromCharCode(97 + i), 2));
    }
    for (let i = noteCount - 1; i >= 0; i--) {
      active.push(note(noteCount + (noteCount - 1 - i), String.fromCharCode(97 + i), 1));
    }
    const activeCols = noteCount * 2;
    return wrapFill(buildGrid(TOTAL_COLS, noteCount, active), activeCols);
  }
  return {
    id: 'builtin-arp-down-2oct',
    name: 'Arpeggio down 2 oct',
    loop: true,
    columns: Array(TOTAL_COLS).fill('8n'),
    subPatterns: { 3: makeGrid(3), 4: makeGrid(4), 5: makeGrid(5) },
  };
}

/**
 * Arpeggio up/down — ascend oct 1 then descend back (pendulum).
 * 10 columns total; smaller sub-patterns wrap-fill trailing columns.
 */
function makeArpUpDown() {
  const TOTAL_COLS = 10;
  function makeGrid(noteCount) {
    const active = [];
    // Up: a1, b1, c1, ...
    for (let i = 0; i < noteCount; i++) {
      active.push(note(i, String.fromCharCode(97 + i), 1));
    }
    // Down: skip top and bottom endpoints to avoid repetition
    for (let i = noteCount - 2; i >= 1; i--) {
      active.push(note(noteCount + (noteCount - 2 - i), String.fromCharCode(97 + i), 1));
    }
    const activeCols = noteCount + Math.max(0, noteCount - 2);
    return wrapFill(buildGrid(TOTAL_COLS, noteCount, active), activeCols);
  }
  return {
    id: 'builtin-arp-updown',
    name: 'Arpeggio up/down',
    loop: true,
    columns: Array(TOTAL_COLS).fill('8n'),
    subPatterns: { 3: makeGrid(3), 4: makeGrid(4), 5: makeGrid(5) },
  };
}

/**
 * Arpeggio down/up — descend then ascend back.
 * 10 columns total; smaller sub-patterns wrap-fill trailing columns.
 */
function makeArpDownUp() {
  const TOTAL_COLS = 10;
  function makeGrid(noteCount) {
    const active = [];
    // Down: c1, b1, a1, ...
    for (let i = noteCount - 1; i >= 0; i--) {
      active.push(note(noteCount - 1 - i, String.fromCharCode(97 + i), 1));
    }
    // Up: skip bottom, come back (b1, c1, ...)
    for (let i = 1; i <= noteCount - 2; i++) {
      active.push(note(noteCount + i - 1, String.fromCharCode(97 + i), 1));
    }
    const activeCols = noteCount + Math.max(0, noteCount - 2);
    return wrapFill(buildGrid(TOTAL_COLS, noteCount, active), activeCols);
  }
  return {
    id: 'builtin-arp-downup',
    name: 'Arpeggio down/up',
    loop: true,
    columns: Array(TOTAL_COLS).fill('8n'),
    subPatterns: { 3: makeGrid(3), 4: makeGrid(4), 5: makeGrid(5) },
  };
}

/**
 * Arpeggio 3 notes — open-voiced ascending arpeggio that works for any chord size.
 *
 * Always plays exactly 3 steps (8n each), picking 3 spread voices:
 *   3-note chord  →  a1, b1, c1   (root, 3rd, 5th — all notes)
 *   4-note chord  →  a1, c1, d1   (root, 5th, 7th — skip 3rd)
 *   5-note chord  →  a1, c1, e1   (root, 5th, 9th — skip 3rd & 7th)
 */
function makeArp3Notes() {
  // 3-note: a1→b1→c1
  const grid3 = buildGrid(3, 3, [
    note(0, 'a', 1),
    note(1, 'b', 1),
    note(2, 'c', 1),
  ]);

  // 4-note: a1→c1→d1  (skip b)
  const grid4 = buildGrid(3, 4, [
    note(0, 'a', 1),
    note(1, 'c', 1),
    note(2, 'd', 1),
  ]);

  // 5-note: a1→c1→e1  (skip b and d)
  const grid5 = buildGrid(3, 5, [
    note(0, 'a', 1),
    note(1, 'c', 1),
    note(2, 'e', 1),
  ]);

  return {
    id: 'builtin-arp-3notes',
    name: 'Arpeggio 3 notes',
    loop: true,
    columns: ['8n', '8n', '8n'],
    subPatterns: { 3: grid3, 4: grid4, 5: grid5 },
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const DEFAULT_PATTERNS = [
  makeBlockChord(),
  makeReggaeUpBeat(),
  makePreludeArpegio(),
  makeBuckleyArpegio(),
  makeArpUp1Oct(),
  makeArpDown1Oct(),
  makeArpUp2Oct(),
  makeArpDown2Oct(),
  makeArpUpDown(),
  makeArpDownUp(),
  makeArp3Notes(),
];
