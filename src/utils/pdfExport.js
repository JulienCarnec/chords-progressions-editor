/**
 * exportPdf(state)
 *
 * Opens a print-ready window containing the track sheet:
 *   • Track name & description
 *   • BPM and time signature
 *   • Each arranged section: name, grid of chords, cell size, repetitions
 *
 * No external dependencies — uses the native browser print dialog.
 */

import { chordLabelDisplay } from '../theory/chords';

const CELL_DURATION_LABEL = {
  whole:   'Whole note',
  half:    'Half note',
  quarter: 'Quarter note',
  eighth:  'Eighth note',
};

/** Return a human-readable chord label for a chord object, or an empty string. */
function cellLabel(chord) {
  if (!chord) return '';
  if (!chord.typeKey && chord.customNotes?.length) {
    return chord.customNotes.join(' ');
  }
  return chordLabelDisplay(chord.root, chord.typeKey, false) ?? '';
}

/** Return the label for one cell slot (handles split cells). */
function slotLabel(cell) {
  if (!cell) return '';
  if (cell.split && cell.subCells?.length) {
    const a = cellLabel(cell.subCells[0] ?? null);
    const b = cellLabel(cell.subCells[1] ?? null);
    if (a && b) return `${a} / ${b}`;
    return a || b;
  }
  return cellLabel(cell.chord ?? null);
}

/** Break an array into rows of `size`. */
function chunk(arr, size) {
  const rows = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

/** Build the full HTML document string. */
function buildDocument(state) {
  const {
    trackName,
    trackDescription,
    bpm,
    timeSig,
    track,
    progressions,
  } = state;

  const name = trackName?.trim() || 'Untitled';
  const desc = trackDescription?.trim() || '';

  // ── Section HTML ────────────────────────────────────────────────────────────
  const sectionsHtml = track
    .map(({ progressionId, repetitions }, idx) => {
      const prog = progressions[progressionId];
      if (!prog) return '';

      const cells = prog.cells ?? [];
      const cellCount = cells.length;
      const durLabel = CELL_DURATION_LABEL[prog.cellDuration ?? 'whole'] ?? (prog.cellDuration ?? 'whole');
      const reps = repetitions ?? 1;
      const rows = chunk(cells, 4);

      // Build grid rows HTML
      const gridRows = rows.map(row => {
        const tds = row.map(cell => {
          const label = slotLabel(cell);
          return `<td class="${label ? 'cell-filled' : 'cell-empty'}">${label || '—'}</td>`;
        }).join('');
        return `<tr>${tds}</tr>`;
      }).join('');

      return `
        <section class="section-block">
          <div class="section-header">
            <span class="section-index">${String(idx + 1).padStart(2, '0')}</span>
            <span class="section-name">${escHtml(prog.name)}</span>
            <span class="section-meta">${cellCount} cell${cellCount !== 1 ? 's' : ''} · ${escHtml(durLabel)} · ×${reps}</span>
          </div>
          <table class="chord-grid">
            <tbody>${gridRows}</tbody>
          </table>
        </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escHtml(name)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    line-height: 1.55;
    color: #1a1a2e;
    background: #fff;
    padding: 48px 56px;
    max-width: 860px;
    margin: 0 auto;
  }

  /* ── Cover area ──────────────────────────────────────────── */
  .cover {
    border-bottom: 2px solid #1a1a2e;
    padding-bottom: 28px;
    margin-bottom: 40px;
  }

  .track-title {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-size: 38px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: #1a1a2e;
    margin-bottom: 10px;
    line-height: 1.15;
  }

  .track-description {
    font-size: 13.5px;
    color: #4a4a6a;
    max-width: 620px;
    line-height: 1.65;
    margin-bottom: 18px;
    white-space: pre-wrap;
  }

  .track-meta {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }

  .meta-chip {
    display: flex;
    align-items: baseline;
    gap: 5px;
    padding: 5px 14px;
    background: #f0f0fa;
    border-radius: 20px;
    border: 1px solid #d0d0e8;
  }

  .meta-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #7070a0;
  }

  .meta-value {
    font-size: 16px;
    font-weight: 700;
    color: #1a1a2e;
    letter-spacing: 0.01em;
  }

  /* ── Section blocks ─────────────────────────────────────── */
  .section-block {
    margin-bottom: 32px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .section-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 10px;
  }

  .section-index {
    font-size: 11px;
    font-weight: 700;
    color: #9090c0;
    letter-spacing: 0.06em;
    font-variant-numeric: tabular-nums;
    min-width: 20px;
  }

  .section-name {
    font-size: 17px;
    font-weight: 700;
    color: #1a1a2e;
    letter-spacing: -0.2px;
  }

  .section-meta {
    font-size: 11px;
    color: #8080aa;
    background: #f5f5fc;
    border: 1px solid #e0e0f0;
    border-radius: 12px;
    padding: 2px 9px;
    font-weight: 500;
    white-space: nowrap;
  }

  /* ── Chord grid table ───────────────────────────────────── */
  .chord-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .chord-grid td {
    border: 1px solid #d0d0e8;
    padding: 10px 8px;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    background: #fafaff;
    vertical-align: middle;
    min-height: 42px;
  }

  .chord-grid td.cell-empty {
    color: #c0c0d8;
    font-weight: 400;
    background: #f7f7fc;
  }

  .chord-grid tr:first-child td:first-child { border-top-left-radius: 6px; }
  .chord-grid tr:first-child td:last-child  { border-top-right-radius: 6px; }
  .chord-grid tr:last-child  td:first-child { border-bottom-left-radius: 6px; }
  .chord-grid tr:last-child  td:last-child  { border-bottom-right-radius: 6px; }

  /* ── Print overrides ────────────────────────────────────── */
  @media print {
    body { padding: 20px 28px; }
    .section-block { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="cover">
    <h1 class="track-title">${escHtml(name)}</h1>
    ${desc ? `<p class="track-description">${escHtml(desc)}</p>` : ''}
    <div class="track-meta">
      <div class="meta-chip">
        <span class="meta-label">BPM</span>
        <span class="meta-value">${bpm}</span>
      </div>
      <div class="meta-chip">
        <span class="meta-label">Time</span>
        <span class="meta-value">${escHtml(timeSig)}</span>
      </div>
    </div>
  </div>

  ${sectionsHtml || '<p style="color:#9090c0;font-size:14px;">No sections in the arrangement yet.</p>'}
</body>
</html>`;
}

/** Minimal HTML escaping for user-supplied text. */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Open a print window with the formatted track sheet. */
export function exportPdf(state) {
  const html = buildDocument(state);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return; // popup blocked
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Trigger print after fonts/styles load
  win.onload = () => win.print();
}
