
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface Player {
  id: number;
  name: string;
  isAi: boolean;
  lives: number; // Starts at 3
  isEliminated: boolean;
  color: string;
  avatar: string; // Emoji avatar
  lastAction?: string; // Text to show in speech bubble
  lastActionTime?: number; // Timestamp for fading out bubble
}

export interface GameStats {
  score: number;
  rank: number;
  totalPlayers: number;
  reason: string;
}

export interface AiCommentary {
  text: string;
  mood: 'happy' | 'sarcastic' | 'neutral';
}
