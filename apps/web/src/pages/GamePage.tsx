import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Crown,
  Dices,
  Home,
  Loader2,
  MessageSquare,
  MousePointerClick,
  UserRound,
  X,
} from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { useSocket } from '../hooks/useSocket';
import { LudoBoard } from '../components/game/LudoBoard';
import { Dice } from '../components/game/Dice';
import { PlayerPanel } from '../components/game/PlayerPanel';
import { WaitingRoom } from '../components/game/WaitingRoom';
import { GameOver } from '../components/game/GameOver';
import { Chat } from '../components/game/Chat';

export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { joinGameRoom, leaveRoom, rollDice, moveToken } = useSocket();
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenMessageRef = useRef<number>(0);
  const hasInitializedChatRef = useRef(false);

  const {
    phase,
    room,
    gameState,
    myPlayerId,
    isMyTurn,
    canRoll,
    validMoves,
    error,
    messages,
  } = useGameStore();

  useEffect(() => {
    if (!hasInitializedChatRef.current) {
      lastSeenMessageRef.current = messages[messages.length - 1]?.timestamp ?? 0;
      hasInitializedChatRef.current = true;
      return;
    }

    if (showChat) {
      lastSeenMessageRef.current = messages[messages.length - 1]?.timestamp ?? lastSeenMessageRef.current;
      setUnreadCount(0);
      return;
    }

    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.timestamp <= lastSeenMessageRef.current) return;

    const newFromOthers = messages.filter(
      (message) =>
        message.timestamp > lastSeenMessageRef.current && message.playerId !== myPlayerId
    );

    if (newFromOthers.length > 0) {
      setUnreadCount((prev) => prev + newFromOthers.length);
    }

    lastSeenMessageRef.current = lastMessage.timestamp;
  }, [messages, showChat, myPlayerId]);

  // Track if we've already joined to prevent duplicate joins
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (roomId && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      joinGameRoom(roomId);
    }

    return () => {
      if (roomId && hasJoinedRef.current) {
        hasJoinedRef.current = false;
        leaveRoom(roomId);
      }
    };
  }, [roomId]);

  const handleLeave = () => {
    if (roomId) {
      leaveRoom(roomId);
    }
    navigate('/lobby');
  };

  const handleRollDice = () => {
    if (roomId && canRoll) {
      rollDice(roomId);
    }
  };

  const handleTokenClick = (tokenId: number) => {
    if (roomId && validMoves.includes(tokenId)) {
      moveToken(roomId, tokenId);
    }
  };

  // Loading state
  if (phase === 'connecting') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Connecting to game...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center max-w-md w-full">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2">Connection Error</h2>
          <p className="text-gray-400 mb-4">{error || 'Something went wrong'}</p>
          <button onClick={() => navigate('/lobby')} className="btn btn-primary">
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Waiting room
  if (phase === 'waiting' && room) {
    return <WaitingRoom room={room} onLeave={handleLeave} />;
  }

  // Game over
  if (phase === 'finished') {
    return <GameOver onLeave={handleLeave} />;
  }

  // Game in progress
  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-2 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:p-4 bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={handleLeave}
            className="text-gray-400 hover:text-white text-sm md:text-base"
          >
            ← Leave
          </button>
          <div className="hidden sm:block h-4 w-px bg-gray-700" />
          <span className="text-xs md:text-sm text-gray-400">
            Code: <span className="text-purple-400 font-mono">{room?.inviteCode}</span>
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-x-hidden">
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_380px] gap-6 h-full max-w-7xl mx-auto p-4">
          {/* Game Area */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <LudoBoard
                players={gameState?.players || []}
                validMoves={validMoves}
                myPlayerId={myPlayerId}
                isMyTurn={isMyTurn}
                onTokenClick={handleTokenClick}
              />
              {/* Center dice */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto">
                  <Dice
                    value={gameState?.diceValue || null}
                    canRoll={canRoll}
                    isMyTurn={isMyTurn}
                    onRoll={handleRollDice}
                  />
                </div>
              </div>
            </div>

            {/* Turn indicator */}
            <TurnIndicator isMyTurn={isMyTurn} canRoll={canRoll} validMoves={validMoves} />
          </div>

          {/* Side Panel */}
          <div className="space-y-4 overflow-auto padding-2">
            <div className="card margin-2">
              <h2 className="text-lg font-bold mb-4">Players</h2>
              <div className="space-y-2">
                {gameState?.players.map((player) => (
                  <PlayerPanel
                    key={player.id}
                    player={player}
                    isCurrentTurn={gameState.currentTurn === player.id}
                    isYou={player.id === myPlayerId}
                  />
                ))}
              </div>
            </div>
            <Chat roomId={roomId!} />
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden flex flex-col h-full px-2 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          {/* Players - Horizontal scroll */}
          <div className="flex-shrink-0 flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1 mt-1">
            {gameState?.players.map((player) => (
              <MobilePlayerCard
                key={player.id}
                player={player}
                isCurrentTurn={gameState.currentTurn === player.id}
                isYou={player.id === myPlayerId}
              />
            ))}
          </div>

          {/* Board and Dice Container - Takes remaining space */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 gap-3">
            {/* Board container - fixed scale for predictable sizing */}
            <div className="flex items-center justify-center w-full">
              <div
                className="transform origin-center"
                style={{ transform: 'scale(0.62)' }}
              >
                <LudoBoard
                  players={gameState?.players || []}
                  validMoves={validMoves}
                  myPlayerId={myPlayerId}
                  isMyTurn={isMyTurn}
                  onTokenClick={handleTokenClick}
                />
              </div>
            </div>

            {/* Dice and Turn indicator */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-3 shadow-xl">
                <Dice
                  value={gameState?.diceValue || null}
                  canRoll={canRoll}
                  isMyTurn={isMyTurn}
                  onRoll={handleRollDice}
                />
              </div>
              <TurnIndicator isMyTurn={isMyTurn} canRoll={canRoll} validMoves={validMoves} />
            </div>
          </div>

          {/* Chat toggle button */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="fixed w-11 h-11 bg-purple-600 rounded-full shadow-lg flex items-center justify-center text-white z-40 active:scale-95 transition-transform"
            style={{
              bottom: 'max(env(safe-area-inset-bottom, 16px), 16px)',
              left: '16px',
            }}
            aria-label={
              unreadCount > 0
                ? `Open chat (${unreadCount} new message${unreadCount > 1 ? 's' : ''})`
                : 'Open chat'
            }
          >
            <MessageSquare className="w-5 h-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold leading-[18px] text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Chat overlay */}
          <AnimatePresence>
            {showChat && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed inset-x-0 bottom-0 h-[60vh] bg-gray-900 rounded-t-2xl shadow-2xl z-50 flex flex-col pb-[env(safe-area-inset-bottom)]"
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                  <h3 className="font-bold">Chat</h3>
                  <button
                    onClick={() => setShowChat(false)}
                    className="text-gray-400 hover:text-white"
                    aria-label="Close chat"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Chat roomId={roomId!} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Turn indicator component
function TurnIndicator({ 
  isMyTurn, 
  canRoll, 
  validMoves
}: { 
  isMyTurn: boolean; 
  canRoll: boolean; 
  validMoves: number[];
}) {
  if (!isMyTurn) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl blur-md opacity-50" />
      <div className="relative bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl px-5 py-3 shadow-lg border border-purple-400/30">
        <div className="flex items-center justify-center gap-2">
          {canRoll ? (
            <>
              <Dices className="w-6 h-6 text-white animate-bounce" aria-hidden="true" />
              <span className="text-white font-bold text-base md:text-lg">
                Your Turn - Roll!
              </span>
            </>
          ) : validMoves.length > 0 ? (
            <>
              <MousePointerClick className="w-5 h-5 text-white" aria-hidden="true" />
              <span className="text-white font-bold text-base md:text-lg">
                Select a token
              </span>
            </>
          ) : (
            <>
              <Loader2 className="w-5 h-5 text-white animate-spin" aria-hidden="true" />
              <span className="text-white font-medium text-sm md:text-base">
                No valid moves...
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Mobile player card
function MobilePlayerCard({
  player,
  isCurrentTurn,
  isYou,
}: {
  player: { id: string; displayName: string; color: string; tokensHome: number };
  isCurrentTurn: boolean;
  isYou: boolean;
}) {
  const colorBg: Record<string, string> = {
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <div
      className={`
        flex-shrink-0 rounded-lg
        ${isCurrentTurn ? 'ring-2 ring-white shadow-lg' : 'opacity-75'}
        transition-all duration-300
      `}
    >
      <div className={`${colorBg[player.color] || 'bg-gray-600'} px-2 py-1.5 rounded-lg`}>
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div
            className={`w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white ${
              isYou ? 'ring-2 ring-yellow-300' : ''
            }`}
          >
            {player.displayName.charAt(0).toUpperCase()}
          </div>
          {/* Info */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <UserRound className="w-3 h-3 text-white/80" aria-hidden="true" />
              <span className="text-sm font-semibold text-white max-w-[80px] truncate">
                {player.displayName}
              </span>
              {isYou && (
                <Crown className="w-3 h-3 text-yellow-300" aria-hidden="true" />
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/80">
              <span className="flex items-center gap-0.5">
                <Home className="w-3 h-3" aria-hidden="true" />
                {player.tokensHome}/4
              </span>
              {isCurrentTurn && (
                <span className="flex items-center gap-0.5">
                  <Activity className="w-3 h-3" aria-hidden="true" />
                  Playing
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
