export interface ReplayFrame {
  timeDelta: number;
  x: number;
  y: number;
  keys: number;
}

export interface ReplayData {
  mode: number;
  version: number;
  beatmapHash: string;
  playerName: string;
  replayHash: string;
  count300: number;
  count100: number;
  count50: number;
  countGeki: number;
  countKatu: number;
  countMiss: number;
  score: number;
  maxCombo: number;
  perfect: number;
  mods: number;
  lifeBar: string;
  timestamp: bigint;
  scoreId: bigint;
  targetPracticeAccuracy: number | null;
  frames: ReplayFrame[];
}
