// ============================================================
// Sound effects + playful background music using Web Audio API
// ============================================================

let audioCtx: AudioContext | null = null;
let _sfxMuted = true;
let _musicMuted = true;
let _musicPlaying = false;
let _musicTimeout: ReturnType<typeof setTimeout> | null = null;
let _musicGain: GainNode | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

// ---- Mute state ----

export function isSfxMuted(): boolean { return _sfxMuted; }
export function isMusicMuted(): boolean { return _musicMuted; }

export function toggleSfxMute(): boolean {
  _sfxMuted = !_sfxMuted;
  localStorage.setItem('letterguess_sfx_muted', _sfxMuted ? '1' : '0');
  return _sfxMuted;
}

export function toggleMusicMute(): boolean {
  _musicMuted = !_musicMuted;
  localStorage.setItem('letterguess_music_muted', _musicMuted ? '1' : '0');
  if (_musicMuted) stopMusic();
  else startMusic();
  return _musicMuted;
}

export function loadMuteStates(): { sfx: boolean; music: boolean } {
  if (typeof window === 'undefined') return { sfx: true, music: true };
  const sfx = localStorage.getItem('letterguess_sfx_muted');
  const music = localStorage.getItem('letterguess_music_muted');
  _sfxMuted = sfx === null ? true : sfx === '1';
  _musicMuted = music === null ? true : music === '1';
  return { sfx: _sfxMuted, music: _musicMuted };
}

// ---- Playful Music Loop ----

// Cheerful pentatonic melody — 16 beats, loops forever
const MELODY: [number, number][] = [
  // note frequency, duration in beats (1 beat = 0.18s)
  [523.25, 1], [659.25, 1], [783.99, 2],           // C5 E5 G5 —
  [783.99, 0.5], [880.00, 0.5], [783.99, 1],        // G5 A5 G5
  [659.25, 2],                                        // E5 —
  [587.33, 1], [659.25, 1], [523.25, 2],             // D5 E5 C5
  [523.25, 0.5], [587.33, 0.5], [659.25, 1],         // C5 D5 E5
  [523.25, 2],                                        // C5 —
  [783.99, 1], [880.00, 1], [1046.5, 2],             // G5 A5 C6 —
  [1046.5, 0.5], [880.00, 0.5], [783.99, 1],         // C6 A5 G5
  [659.25, 2],                                        // E5 —
  [523.25, 1], [659.25, 1], [783.99, 1], [659.25, 1],// C5 E5 G5 E5
  [523.25, 3],                                        // C5 — —
];

const BASS: [number, number][] = [
  [130.81, 4], [164.81, 4], [196.00, 4], [130.81, 4],  // C3 E3 G3 C3
  [146.83, 4], [196.00, 4], [130.81, 4], [130.81, 4],  // D3 G3 C3 C3
];

const BEAT_S = 0.18; // seconds per beat
let _melodyIndex = 0;
let _bassIndex = 0;

function scheduleMelodyNote(): void {
  if (!_musicPlaying || _musicMuted) return;
  try {
    const c = ctx();
    const [freq, beats] = MELODY[_melodyIndex % MELODY.length];
    const duration = beats * BEAT_S;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration * 0.85);
    osc.connect(gain);
    if (_musicGain) gain.connect(_musicGain);
    else gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);

    _melodyIndex++;
    _musicTimeout = setTimeout(scheduleMelodyNote, duration * 1000);
  } catch (e) {}
}

function scheduleBassNote(): void {
  if (!_musicPlaying || _musicMuted) return;
  try {
    const c = ctx();
    const [freq, beats] = BASS[_bassIndex % BASS.length];
    const duration = beats * BEAT_S;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration * 0.9);
    osc.connect(gain);
    if (_musicGain) gain.connect(_musicGain);
    else gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);

    _bassIndex++;
    _musicTimeout = setTimeout(scheduleBassNote, duration * 1000);
  } catch (e) {}
}

export function startMusic(): void {
  if (_musicMuted || _musicPlaying) return;
  try {
    const c = ctx();
    _musicGain = c.createGain();
    _musicGain.gain.value = 0.25;
    _musicGain.connect(c.destination);
    
    _musicPlaying = true;
    _melodyIndex = 0;
    _bassIndex = 0;
    scheduleMelodyNote();
    scheduleBassNote();
  } catch (e) {}
}

export function stopMusic(): void {
  _musicPlaying = false;
  if (_musicTimeout) { clearTimeout(_musicTimeout); _musicTimeout = null; }
  _musicGain = null;
}

// ---- SFX (10x louder) ----

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.5) {
  if (_sfxMuted) return;
  try {
    const c = ctx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch (e) {}
}

export function playCorrectLetter() {
  playTone(523, 0.12, 'square', 0.4);
  setTimeout(() => playTone(659, 0.12, 'square', 0.4), 80);
  setTimeout(() => playTone(784, 0.15, 'square', 0.4), 160);
}

export function playWrongLetter() {
  playTone(200, 0.25, 'sawtooth', 0.35);
  setTimeout(() => playTone(180, 0.3, 'sawtooth', 0.35), 100);
}

export function playYourTurn() {
  playTone(880, 0.1, 'square', 0.4);
  setTimeout(() => playTone(1100, 0.12, 'square', 0.4), 100);
}

export function playCorrectAnswer() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.25, 'square', 0.45), i * 130);
  });
}

export function playWrongAnswer() {
  [400, 350, 300, 200].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, 'sawtooth', 0.35), i * 170);
  });
}

export function playEliminated() {
  [600, 500, 400, 200].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.35, 'sawtooth', 0.4), i * 220);
  });
}

export function playRoundWin() {
  [523, 659, 784, 1047, 784, 1047].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.18, 'square', 0.4), i * 110);
  });
}

export function playNobodyWon() {
  playTone(300, 0.4, 'triangle', 0.25);
  setTimeout(() => playTone(250, 0.5, 'triangle', 0.25), 250);
}
