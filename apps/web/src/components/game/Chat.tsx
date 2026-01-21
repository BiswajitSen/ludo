import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';

interface ChatProps {
  roomId: string;
}

const QUICK_CHATS = ['👋', '👍', '😄', '🎉', '😮', '🤔', '😢', '💪'];

export function Chat({ roomId }: ChatProps) {
  const messages = useGameStore((state) => state.messages);
  const { sendMessage } = useSocket();
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(roomId, input.trim(), 'text');
    setInput('');
  };

  const handleQuickChat = (emoji: string) => {
    sendMessage(roomId, emoji, 'emoji');
  };

  return (
    <div className="card flex flex-col h-full lg:h-80">
      {/* Header - hidden in mobile overlay mode */}
      <div className="hidden lg:flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Chat</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-400 hover:text-white"
        >
          {isOpen ? '−' : '+'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {(isOpen || true) && ( // Always open - mobile uses overlay
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden min-h-0"
          >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-center text-sm py-4">
                  No messages yet
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={`${msg.timestamp}-${msg.playerId}`}
                    className="text-sm"
                  >
                    <span className="font-semibold text-purple-400">
                      {msg.displayName}:
                    </span>{' '}
                    <span className="text-gray-300">{msg.message}</span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick chats */}
            <div className="flex gap-1 mb-2">
              {QUICK_CHATS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleQuickChat(emoji)}
                  className="text-lg hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="input text-sm py-2"
                maxLength={100}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="btn btn-primary px-4 py-2 text-sm"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
