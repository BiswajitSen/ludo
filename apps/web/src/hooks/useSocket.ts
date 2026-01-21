import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@ludo/types';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Get WebSocket URL - use same origin to go through Vite proxy
const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  return window.location.origin;
};

export function useSocket() {
  const socketRef = useRef<GameSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const moveSequenceRef = useRef(0);

  const { accessToken } = useAuthStore();

  // Helper to get latest store state (avoids stale closures)
  const getStore = () => useGameStore.getState();

  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const WS_URL = getWsUrl();
    console.log('Connecting to WebSocket:', WS_URL);

    const socket: GameSocket = io(WS_URL, {
      path: '/ws',
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected');
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    socket.on('connection:established', (data) => {
      getStore().setMyPlayerId(data.playerId);
    });

    socket.on('connection:error', (data) => {
      getStore().setError(data.message);
    });

    // Room events
    socket.on('room:joined', (data) => {
      const store = getStore();
      store.setRoom(data.room);
      store.setConnectionInfo(data.room.id, data.rejoinToken);
      store.setMyPlayerId(data.yourPlayerId);

      if (data.gameState) {
        store.setGameState(data.gameState);
      }
    });

    socket.on('room:playerJoined', (data) => {
      getStore().addPlayer(data.player);
    });

    socket.on('room:playerLeft', (data) => {
      getStore().removePlayer(data.playerId);
    });

    socket.on('room:playerReady', (data) => {
      getStore().setPlayerReady(data.playerId, data.ready);
    });

    socket.on('game:started', (data) => {
      getStore().setGameState(data.gameState);
    });

    socket.on('game:turnStart', (data) => {
      console.log('Turn started:', data.playerId, 'Turn number:', data.turnNumber);
      const state = getStore().gameState;
      if (state) {
        getStore().setGameState({
          ...state,
          currentTurn: data.playerId,
          turnNumber: data.turnNumber,
          turnPhase: 'rolling',
          diceValue: null,
          validMoves: [],
        });
      }
      getStore().setTurnTimeRemaining(data.duration / 1000);
    });

    socket.on('game:diceResult', (data) => {
      console.log('Dice result:', data.value, 'Valid moves:', data.validMoves);
      getStore().setDiceResult(data.value, data.validMoves);
    });

    socket.on('game:moveExecuted', (data) => {
      getStore().updateBoardState(data.boardState);
    });

    socket.on('game:ended', () => {
      getStore().setPhase('finished');
    });

    socket.on('chat:message', (message) => {
      getStore().addMessage(message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [accessToken]);

  const createRoom = useCallback(
    async (isPrivate: boolean): Promise<string> => {
      return new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
          reject(new Error('Not connected'));
          return;
        }

        socket.emit('room:create', { isPrivate: isPrivate });

        // Wait for room:joined event
        const timeout = setTimeout(() => {
          socket.off('room:joined', handleJoined);
          socket.off('error', handleError);
          reject(new Error('Timeout creating room'));
        }, 10000);

        const handleJoined = (data: any) => {
          clearTimeout(timeout);
          socket.off('room:joined', handleJoined);
          socket.off('error', handleError);
          resolve(data.room.id);
        };

        const handleError = (data: any) => {
          clearTimeout(timeout);
          socket.off('room:joined', handleJoined);
          socket.off('error', handleError);
          reject(new Error(data.message));
        };

        socket.on('room:joined', handleJoined);
        socket.on('error', handleError);
      });
    },
    []
  );

  const joinRoom = useCallback(async (inviteCode: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        reject(new Error('Not connected'));
        return;
      }

      socket.emit('room:join', { roomId: inviteCode });

      const timeout = setTimeout(() => {
        socket.off('room:joined', handleJoined);
        socket.off('error', handleError);
        reject(new Error('Timeout joining room'));
      }, 10000);

      const handleJoined = (data: any) => {
        clearTimeout(timeout);
        socket.off('room:joined', handleJoined);
        socket.off('error', handleError);
        resolve(data.room.id);
      };

      const handleError = (data: any) => {
        clearTimeout(timeout);
        socket.off('room:joined', handleJoined);
        socket.off('error', handleError);
        reject(new Error(data.message));
      };

      socket.on('room:joined', handleJoined);
      socket.on('error', handleError);
    });
  }, []);

  const joinGameRoom = useCallback((roomId: string) => {
    const rejoinToken = getStore().rejoinToken;
    socketRef.current?.emit('room:join', { roomId, rejoinToken: rejoinToken || undefined });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('room:leave', { roomId });
    getStore().reset();
  }, []);

  const setReady = useCallback((roomId: string, ready: boolean) => {
    socketRef.current?.emit('room:ready', { roomId, ready });
  }, []);

  const startGame = useCallback((roomId: string) => {
    socketRef.current?.emit('room:start', { roomId });
  }, []);

  const rollDice = useCallback((roomId: string) => {
    socketRef.current?.emit('game:roll', { roomId, timestamp: Date.now() });
  }, []);

  const moveToken = useCallback((roomId: string, tokenId: number) => {
    moveSequenceRef.current++;
    socketRef.current?.emit('game:move', {
      roomId,
      tokenId,
      moveSequence: moveSequenceRef.current,
    });
  }, []);

  const sendMessage = useCallback(
    (roomId: string, message: string, type: 'text' | 'emoji' | 'quickChat') => {
      socketRef.current?.emit('chat:message', { roomId, message, type });
    },
    []
  );

  return {
    socket: socketRef.current,
    isConnected,
    createRoom,
    joinRoom,
    joinGameRoom,
    leaveRoom,
    setReady,
    startGame,
    rollDice,
    moveToken,
    sendMessage,
  };
}
