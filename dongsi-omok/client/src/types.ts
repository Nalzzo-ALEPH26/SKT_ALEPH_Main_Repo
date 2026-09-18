export interface Position {
  row: number;
  col: number;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  colorIndex: number;
  connected: boolean;
  ready: boolean;
}

export type RoomPhase = 'LOBBY' | 'INITIAL_PLACEMENT' | 'PLANNING' | 'RESOLVING' | 'FINISHED';

export interface PublicRoom {
  id: string;
  hostId: string;
  phase: RoomPhase;
  board: (string | null)[][];
  round: number;
  roundEndsAt: number | null;
  initialOrder: string[];
  initialTurnIndex: number;
  initialPlaced: Record<string, number>;
  winners: string[];
  players: PublicPlayer[];
  conversionAvailable: boolean;
}

export interface RoundResolution {
  board: (string | null)[][];
  collisions: Position[];
  placed: Array<{ playerId: string; position: Position }>;
  revealedSelections: Record<string, Position[]>;
  winners: string[];
  converted?: Array<{ fromPlayerId: string; toPlayerId: string; position: Position }>;
}
