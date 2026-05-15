export type ParsedHitObject =
  | { kind: 'circle'; x: number; y: number; time: number; newCombo?: boolean }
  | {
      kind: 'slider';
      x: number;
      y: number;
      time: number;
      points: { x: number; y: number }[];
      repeatCount?: number;
      slides?: number;
      lengthPx?: number;
      newCombo?: boolean;
      approxEndMs?: number;
    }
  | { kind: 'spinner'; x: number; y: number; time: number; endTime: number };

export type OsuParseResult = {
  objects: ParsedHitObject[];
  hitObjectLineCount: number;
  skippedLines: number;
  approachRate: number;
  sliderMultiplier: number;
  beatLengthMs: number;
  timingPoints: {
    time: number;
    beatLengthMs: number;
    sliderVelocityMultiplier: number;
    inherited: boolean;
  }[];
};
