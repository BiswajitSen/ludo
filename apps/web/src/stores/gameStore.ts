import { create } from 'zustand';
import type { Room, GameState, Player, RoomPlayer } from '@ludo/types';

type GamePhase = 'connecting' | 'waiting' | 'playing' | 'finished' | 'error';

interface ChatMessage {
  playerId: string;
  displayName: string;
  message: string;
  type: 'text' | 'emoji' | 'quickChat';
  timestamp: number;
}

interface GameStore {
  // Connection state
  phase: GamePhase;
  roomId: string | null;
  rejoinToken: string | null;
  error: string | null;

  // Room state
  room: Room | null;

  // Game state
  gameState: GameState | null;
  myPlayerId: string | null;
  isMyTurn: boolean;
  canRoll: boolean;
  validMoves: number[];
  turnTimeRemaining: number;

  // Chat state
  messages: ChatMessage[];

  // Actions
  setPhase: (phase: GamePhase) => void;
  setRoom: (room: Room) => void;
  setGameState: (state: GameState) => void;
  setMyPlayerId: (id: string) => void;
  setConnectionInfo: (roomId: string, rejoinToken: string) => void;
  setError: (error: string) => void;

  // Game actions
  setDiceResult: (value: number, validMoves: number[]) => void;
  updateBoardState: (players: Player[]) => void;
  setTurnTimeRemaining: (time: number) => void;

  // Player events
  addPlayer: (player: RoomPlayer) => void;
  removePlayer: (playerId: string) => void;
  setPlayerReady: (playerId: string, ready: boolean) => void;

  // Chat
  addMessage: (message: ChatMessage) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  phase: 'connecting' as GamePhase,
  roomId: null,
  rejoinToken: null,
  error: null,
  room: null,
  gameState: null,
  myPlayerId: null,
  isMyTurn: false,
  canRoll: false,
  validMoves: [],
  turnTimeRemaining: 30,
  messages: [],
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),

  setRoom: (room) => set({ room, phase: room.status === 'playing' ? 'playing' : 'waiting' }),

  setGameState: (gameState) => {
    const myPlayerId = get().myPlayerId;
    const isMyTurn = gameState.currentTurn === myPlayerId;
    const canRoll = isMyTurn && gameState.turnPhase === 'rolling';

    set({
      gameState,
      isMyTurn,
      canRoll,
      validMoves: isMyTurn ? gameState.validMoves : [],
      phase: gameState.phase === 'finished' ? 'finished' : 'playing',
    });
  },

  setMyPlayerId: (id) => set({ myPlayerId: id }),

  setConnectionInfo: (roomId, rejoinToken) => set({ roomId, rejoinToken }),

  setError: (error) => set({ error, phase: 'error' }),

  setDiceResult: (value, validMoves) => {
    const myPlayerId = get().myPlayerId;
    const currentTurn = get().gameState?.currentTurn;
    const isMyTurn = currentTurn === myPlayerId;
    
    console.log('setDiceResult:', { value, validMoves, myPlayerId, currentTurn, isMyTurn });
    
    set((state) => ({
      gameState: state.gameState
        ? { ...state.gameState, diceValue: value, validMoves }
        : null,
      validMoves: isMyTurn ? validMoves : [],
      canRoll: false,
    }));
  },

  updateBoardState: (players) => {
    set((state) => ({
      gameState: state.gameState
        ? { ...state.gameState, players }
        : null,
    }));
  },

  setTurnTimeRemaining: (time) => set({ turnTimeRemaining: time }),

  addPlayer: (player) => {
    set((state) => {
      if (!state.room) return state;
      const existingIndex = state.room.players.findIndex(p => p.id === player.id);
      if (existingIndex >= 0) {
        const updatedPlayers = [...state.room.players];
        updatedPlayers[existingIndex] = player;
        return {
          room: {
            ...state.room,
            players: updatedPlayers,
          },
        };
      }
      return {
        room: {
          ...state.room,
          players: [...state.room.players, player],
        },
      };
    });
  },

  removePlayer: (playerId) => {
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.filter((p) => p.id !== playerId),
        },
      };
    });
  },

  setPlayerReady: (playerId, ready) => {
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === playerId ? { ...p, isReady: ready } : p
          ),
        },
      };
    });
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages.slice(-99), message],
    }));
  },

  reset: () => set(initialState),
}));
