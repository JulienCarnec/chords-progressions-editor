import { useState, useRef, useEffect } from 'react';
import { CHROMATIC, ENHARMONIC, noteIndex } from '../../theory/notes';
import { getScaleNoteSet, getScaleNotes } from '../../theory/scales';
import { getChordNotes, identifyChord } from '../../theory/chords';
import { useSampler } from '../../audio/useSampler';
import styles from './PianoKeyboard.module.css';

const START_OCTAVE = 3;
const NUM_OCTAVES = 2;
const MIN_WHITE_W = 20; // minimum px per white key (never squish below this)
const BLACK_W_RATIO = 0.6; // black key width as fraction of white key width

// White note names in order within an octave
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
// For each white key index (0–6): the sharp name of the black key to its RIGHT, or null
const BLACK_AFTER_SHARP = ['C#', 'D#', null, 'F#', 'G#', 'A#', null];

function buildKeys() {
  const whites = [];
  const blackPositions = []; // { sharp, octave, afterWIdx } — resolved to px at render time
  let wIdx = 0;
  for (let oct = START_OCTAVE; oct < START_OCTAVE + NUM_OCTAVES; oct++) {
    for (let i = 0; i < 7; i++) {
      whites.push({ note: WHITE_NOTES[i], octave: oct, wIdx });
      if (BLACK_AFTER_SHARP[i]) {
        blackPositions.push({ sharp: BLACK_AFTER_SHARP[i], octave: oct, afterWIdx: wIdx });
      }
      wIdx++;
    }
  }
  whites.push({ note: 'C', octave: START_OCTAVE + NUM_OCTAVES, wIdx });
  return { whites, blackPositions };
}

const { whites: WHITE_KEYS, blackPositions: BLACK_POSITIONS } = buildKeys();
const TOTAL_WHITE = WHITE_KEYS.length;

// Scales that use flats (their root uses flat spelling)
const FLAT_ROOTS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']);

/**
 * Given a sharp note name (e.g. 'C#') and the current scale, return the
 * display name: flat if the scale is flat-oriented, sharp otherwise.
 */
function blackKeyDisplayName(sharpName, scaleRoot, scaleKey, scaleNotes) {
  if (!scaleRoot) return sharpName;
  // Prefer flat if the scale's root is a flat root, or if the flat enharmonic
  // appears in the scale's note list
  const flatName = ENHARMONIC[sharpName];
  if (!flatName) return sharpName;
  if (FLAT_ROOTS.has(scaleRoot)) return flatName;
  if (scaleNotes && scaleNotes.includes(flatName)) return flatName;
  if (scaleNotes && scaleNotes.includes(sharpName)) return sharpName;
  return sharpName;
}

export function PianoKeyboard({ scaleRoot, scaleKey, selectedChord, instrument = 'piano', playbackNotes = null }) {
  const { playNotes, playArpeggio } = useSampler();
  const [manualHighlight, setManualHighlight] = useState(new Set());
  const [highlightMode, setHighlightMode] = useState('scale');
  const wrapperRef = useRef(null);
  const [whiteW, setWhiteW] = useState(36);

  // Measure available width and recompute key width
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      setWhiteW(Math.max(MIN_WHITE_W, Math.floor(w / TOTAL_WHITE)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const blackW = Math.round(whiteW * BLACK_W_RATIO);
  const blackH = Math.round(whiteW * 2.2);  // proportional height
  const whiteH = Math.round(whiteW * 3.6);

  const scaleNoteSet = scaleRoot && scaleKey ? getScaleNoteSet(scaleRoot, scaleKey) : new Set();
  const scaleNotes   = scaleRoot && scaleKey ? getScaleNotes(scaleRoot, scaleKey) : [];

  const chordNoteSet = selectedChord
    ? new Set(getChordNotes(selectedChord.root, selectedChord.typeKey).map(n => noteIndex(n)))
    : new Set();

  // Playback highlight: note names from the currently playing chord (no octave)
  const playbackNoteSet = playbackNotes
    ? new Set(playbackNotes.map(n => noteIndex(n)))
    : new Set();

  function isHighlighted(noteIdx) {
    if (highlightMode === 'manual') return manualHighlight.has(noteIdx);
    if (highlightMode === 'chord')  return chordNoteSet.has(noteIdx);
    if (highlightMode === 'scale')  return scaleNoteSet.has(noteIdx);
    return false;
  }

  function handleKeyClick(e, note, octave) {
    e.stopPropagation();
    playNotes([`${note}${octave}`], '4n', instrument);
    if (highlightMode === 'manual') {
      const idx = noteIndex(note);
      setManualHighlight(prev => {
        const next = new Set(prev);
        next.has(idx) ? next.delete(idx) : next.add(idx);
        return next;
      });
    }
  }

  function playHighlighted() {
    let noteIndices;
    if (highlightMode === 'scale') noteIndices = [...scaleNoteSet];
    else if (highlightMode === 'chord') noteIndices = [...chordNoteSet];
    else noteIndices = [...manualHighlight];

    const notes = [...noteIndices]
      .sort((a, b) => a - b)
      .map(idx => `${CHROMATIC[idx]}${START_OCTAVE + 1}`);

    if (highlightMode === 'scale') playArpeggio(notes, 'up', '8n', instrument);
    else playNotes(notes, '2n', instrument);
  }

  const detectedChord = highlightMode === 'manual' && manualHighlight.size >= 2
    ? identifyChord([...manualHighlight])
    : null;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {/* Controls */}
      <div className={styles.controls}>
        <span className={styles.modeLabel}>Highlight:</span>
        {['scale', 'chord', 'manual'].map(mode => (
          <button
            key={mode}
            className={`${styles.modeBtn} ${highlightMode === mode ? styles.active : ''}`}
            onClick={() => setHighlightMode(mode)}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
        <button className={styles.playBtn} onClick={playHighlighted}>▶ Play</button>
        {detectedChord && (
          <span className={styles.detectedChord}>→ {detectedChord.label}</span>
        )}
      </div>

      <div
        className={styles.keyboard}
        style={{ width: '100%', height: whiteH }}
      >
        {/* White keys */}
        {WHITE_KEYS.map(({ note, octave, wIdx }) => {
          const nIdx = noteIndex(note);
          const playing = playbackNoteSet.has(nIdx);
          return (
            <div
              key={`w-${note}${octave}`}
              className={`${styles.white} ${playing ? styles.hl_playing : isHighlighted(nIdx) ? styles[`hl_${highlightMode}`] : ''}`}
              style={{ left: wIdx * whiteW, width: whiteW, height: whiteH }}
              onClick={e => handleKeyClick(e, note, octave)}
            >
              <span className={styles.noteName}>{note}</span>
            </div>
          );
        })}

        {/* Black keys — siblings of white keys, positioned at key boundaries */}
        {BLACK_POSITIONS.map(({ sharp, octave, afterWIdx }) => {
          const nIdx = noteIndex(sharp);
          const playing = playbackNoteSet.has(nIdx);
          const displayName = blackKeyDisplayName(sharp, scaleRoot, scaleKey, scaleNotes);
          const left = (afterWIdx + 1) * whiteW - blackW / 2;
          return (
            <div
              key={`b-${sharp}${octave}`}
              className={`${styles.black} ${playing ? styles.hl_playing_b : isHighlighted(nIdx) ? styles[`hl_${highlightMode}_b`] : ''}`}
              style={{ left, width: blackW, height: blackH }}
              onClick={e => handleKeyClick(e, sharp, octave)}
            >
              <span className={styles.blackNoteName}>{displayName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
