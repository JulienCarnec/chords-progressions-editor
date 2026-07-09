import { useCallback, useRef } from 'react';
import * as Tone from 'tone';

const INSTRUMENT_CONFIGS = {
  piano: {
    urls: {
      A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
      A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
      A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
      A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
      A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
      A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
      A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
      A7: 'A7.mp3', C8: 'C8.mp3',
    },
    baseUrl: 'https://tonejs.github.io/audio/salamander/',
  },
};

// Shared reverb — created once, connected to destination
let reverbNode = null;
function getReverb() {
  if (!reverbNode) {
    reverbNode = new Tone.Reverb({ decay: 1.8, wet: 0.50 }).toDestination();
  }
  return reverbNode;
}

/** Set reverb wet level (0–1) immediately. Safe to call before reverb is created. */
export function setReverbWet(value) {
  if (reverbNode) reverbNode.wet.value = value;
}

function makeSynth() {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 1.2 },
  }).connect(getReverb());
}

let samplerCache = {};
// Single shared promise so concurrent calls all wait for the same load
let samplerLoadingPromise = null;

export function useSampler() {
  const synthRef = useRef(null);

  const getSynth = useCallback(async (instrument = 'piano') => {
    await Tone.start();
    if (instrument !== 'piano') {
      if (!synthRef.current) synthRef.current = makeSynth();
      return synthRef.current;
    }
    // Already loaded — return immediately
    if (samplerCache.piano) return samplerCache.piano;
    // Loading already started — wait for the same promise
    if (samplerLoadingPromise) return samplerLoadingPromise;
    // First call — kick off the load and store the promise
    samplerLoadingPromise = new Promise((resolve) => {
      const sampler = new Tone.Sampler({
        ...INSTRUMENT_CONFIGS.piano,
        onload: () => {
          const s = sampler.connect(getReverb());
          samplerCache.piano = s;
          samplerLoadingPromise = null;
          resolve(s);
        },
      });
    });
    return samplerLoadingPromise;
  }, []);

  const playNotes = useCallback(async (notes, duration = '2n', instrument = 'piano') => {
    const synth = await getSynth(instrument);
    synth.triggerAttackRelease(notes, duration);
  }, [getSynth]);

  const playArpeggio = useCallback(async (notes, style = 'up', noteDuration = '8n', instrument = 'piano') => {
    const synth = await getSynth(instrument);
    let seq = [...notes];
    if (style === 'down') seq = seq.reverse();
    if (style === 'updown') seq = [...seq, ...[...seq].reverse().slice(1)];
    const now = Tone.now();
    const dur = Tone.Time(noteDuration).toSeconds();
    seq.forEach((note, i) => {
      synth.triggerAttackRelease(note, noteDuration, now + i * dur);
    });
  }, [getSynth]);

  return { playNotes, playArpeggio, getSynth, setReverbWet };
}
