export type PlayerId = string;

export interface Position {
  row: number;
  col: number;
}

export type Cell = PlayerId | null;
export type Board = Cell[][];

export type RoomPhase =
  | 'LOBBY'
  | 'INITIAL_PLACEMENT'
  | 'PLANNING'
  | 'RESOLVING'
  | 'FINISHED';

export interface Player {
  id: PlayerId;
  nickname: string;
  colorIndex: number;
  connected: boolean;
  ready: boolean;
  conversionUsed: boolean;
}

export interface Room {
  id: string;
  hostId: PlayerId;
  players: Player[];
  phase: RoomPhase;
  board: Board;
  round: number;
  roundEndsAt: number | null;
  selections: Record<PlayerId, Position[]>;
  conversionTargets: Record<PlayerId, PlayerId | null>;
  conversionClaimedBy: PlayerId | null;
  initialOrder: PlayerId[];
  initialTurnIndex: number;
  initialPlaced: Record<PlayerId, number>;
  winners: PlayerId[];
}

export interface PlacedStone {
  playerId: PlayerId;
  position: Position;
}

export interface ConvertedStone {
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  position: Position;
}

export interface RoundResolution {
  board: Board;
  collisions: Position[];
  placed: PlacedStone[];
  revealedSelections: Record<PlayerId, Position[]>;
  winners: PlayerId[];
  converted?: ConvertedStone[];
}
