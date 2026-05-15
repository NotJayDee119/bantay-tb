import { useEffect, useRef, useState } from "react";
import {
  sendChatMessage,
  type ChatHistoryMessage,
} from "../lib/chatbotService";

interface ChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const NEAREST_CENTER_PATTERNS: RegExp[] = [
  /\bnearest\b.*\b(dots|tb|center|clinic)\b/i,
  /\bwhere\b.*\bnearest\b/i,
  /\bnear\s+me\b/i,
  /\bpinakamalapit\b.*\b(center|dots|tb)\b/i,
  /\bpaka\s*duol\b.*\b(center|dots|tb)\b/i,
];

const MEDICAL_ADVICE_PATTERNS: RegExp[] = [
  /\b(cure|how\s+to\s+cure|gamot|treat(?:ment)?|medic(?:ine|ation)|antibiotic|dose|dosage|reseta|prescription)\b/i,
  /\b(how\s+can\s+i\s+cure\s+tb|how\s+to\s+treat\s+tb|what\s+medicine\s+for\s+tb)\b/i,
  /\b(paano\s+gamutin|gamot\s+sa\s+tb|lunas\s+sa\s+tb|paano\s+malunasan)\b/i,
  /\b(unsaon\s+pag\s+ayo|tambal\s+sa\s+tb|unsa\s+tambal\s+sa\s+tb|pag\s+ayo\s+sa\s+tb)\b/i,
];

function isNearestCenterQuestion(message: string): boolean {
  const text = message.trim();
  return NEAREST_CENTER_PATTERNS.some((pattern) => pattern.test(text));
}

function isMedicalAdviceQuestion(message: string): boolean {
  const text = message.trim();
  return MEDICAL_ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

function getMedicalSafeRedirectReply(): string {
  return "Tuberculosis treatment requires professional medical supervision. I cannot provide treatment guidance. Please refer to official DOH or WHO TB guidelines, or consult a licensed healthcare professional.";
}

function getNearestCenterReply(): string {
  return "To find the nearest TB DOTS center, tap Use My Location in the map section. I can also help list the 12 official TB DOTS centers in Davao City.";
}

export function ChatbotModal({ isOpen, onClose }: ChatbotModalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hello! I'm your TB Assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const scrollTimer = setTimeout(() => {
      scrollToBottom();
    }, 60);
    return () => {
      clearTimeout(scrollTimer);
    };
  }, [isOpen]);

  const handleSendMessage = async (messageText: string = inputValue) => {
    const trimmed = messageText.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    if (isNearestCenterQuestion(trimmed)) {
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: getNearestCenterReply(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }

    if (isMedicalAdviceQuestion(trimmed)) {
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: getMedicalSafeRedirectReply(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }

    setIsLoading(true);
    try {
      const conversationHistory: ChatHistoryMessage[] = messages.map(
        (msg) => ({
          role: msg.role,
          content: msg.content,
        })
      );
      const response = await sendChatMessage(trimmed, conversationHistory);
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "I apologize, but I'm having trouble responding right now. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (question: string) => {
    await handleSendMessage(question);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  const showQuickActions = messages.length === 1;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-[99] transition-opacity duration-300 ${
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsExpanded(false)}
      />

      <div
        className={`fixed bg-white shadow-2xl z-[100] flex flex-col animate-slide-up border border-gray-200 overflow-hidden overscroll-contain transition-all duration-300 ease-in-out ${
          isExpanded
            ? "inset-0 sm:inset-4 lg:inset-8 rounded-none sm:rounded-2xl"
            : "bottom-20 left-2 right-2 sm:left-auto sm:right-4 sm:w-[min(30rem,calc(100vw-2rem))] h-[min(76dvh,42rem)] max-h-[calc(100dvh-5.5rem)] rounded-2xl"
        }`}
      >
        {/* Modern Header with Gradient */}
        <div className="relative bg-gradient-to-br from-[#163034] to-[#1f4449] text-white p-3.5 sm:p-5 flex justify-between items-center overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-400/10 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl"></div>

          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <svg
                className="w-6 h-6 text-[#163034]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-base sm:text-lg">TB Assistant</h4>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-sm text-white font-semibold">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            {/* Expand/Collapse button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-300 flex items-center justify-center text-white"
              title={isExpanded ? "Minimize" : "Expand"}
            >
              {isExpanded ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                  />
                </svg>
              )}
            </button>
            {/* Close button */}
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-300 flex items-center justify-center text-white hover:rotate-90"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 p-2.5 sm:p-4 overflow-y-auto overscroll-contain no-scrollbar bg-gray-50">
          <div className="min-h-full flex flex-col justify-end">
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-2 ${
                    message.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 bg-gradient-to-br from-[#163034] to-[#1f4449] rounded-xl flex items-center justify-center shrink-0 shadow-md">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                        />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl p-3 sm:p-3.5 shadow-sm max-w-[85%] sm:max-w-[75%] ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-[#163034] to-[#1f4449] text-white rounded-tr-md"
                        : "bg-white border border-gray-100 rounded-tl-md"
                    }`}
                  >
                    <p
                      className={`text-sm sm:text-base whitespace-pre-wrap leading-relaxed ${
                        message.role === "user" ? "text-white" : "text-black"
                      }`}
                    >
                      {message.content}
                    </p>
                    <span
                      className={`text-xs mt-1.5 block ${
                        message.role === "user"
                          ? "text-white/80"
                          : "text-black/70"
                      }`}
                    >
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-[#163034] rounded-full flex items-center justify-center shrink-0">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                  </div>
                  <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm">
                    <div className="flex gap-1">
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Action Buttons */}
              {showQuickActions && !isLoading && (
                <div className="flex flex-col gap-2 ml-0 sm:ml-10">
                  <button
                    onClick={() => handleQuickAction("What are TB symptoms?")}
                    className="group bg-white border-2 border-gray-200 rounded-xl p-3.5 text-left text-black hover:border-[#163034] hover:bg-gradient-to-r hover:from-[#163034]/5 hover:to-green-400/5 transition-all duration-300 text-sm sm:text-base font-semibold flex items-center justify-between"
                  >
                    <span>What are TB symptoms?</span>
                    <svg
                      className="w-4 h-4 text-black/70 group-hover:text-[#163034] group-hover:translate-x-1 transition-all"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() =>
                      handleQuickAction("How do I read the hotspot map?")
                    }
                    className="group bg-white border-2 border-gray-200 rounded-xl p-3.5 text-left text-black hover:border-[#163034] hover:bg-gradient-to-r hover:from-[#163034]/5 hover:to-green-400/5 transition-all duration-300 text-sm sm:text-base font-semibold flex items-center justify-between"
                  >
                    <span>How do I read the hotspot map?</span>
                    <svg
                      className="w-4 h-4 text-black/70 group-hover:text-[#163034] group-hover:translate-x-1 transition-all"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() =>
                      handleQuickAction("Find nearest DOTS center")
                    }
                    className="group bg-white border-2 border-gray-200 rounded-xl p-3.5 text-left text-black hover:border-[#163034] hover:bg-gradient-to-r hover:from-[#163034]/5 hover:to-green-400/5 transition-all duration-300 text-sm sm:text-base font-semibold flex items-center justify-between"
                  >
                    <span>Find nearest DOTS center</span>
                    <svg
                      className="w-4 h-4 text-black/70 group-hover:text-[#163034] group-hover:translate-x-1 transition-all"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Modern Input Area */}
        <div className="p-2.5 sm:p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2 items-end">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#163034] focus:border-transparent text-sm sm:text-base text-black placeholder:text-black/60 disabled:bg-gray-100 transition-all duration-300"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="group bg-gradient-to-br from-[#163034] to-[#1f4449] text-white px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none relative overflow-hidden shrink-0"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/0 to-blue-400/0 group-hover:from-green-400/20 group-hover:to-blue-400/20 transition-all duration-300"></div>
              <svg
                className="w-5 h-5 relative z-10 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default ChatbotModal;
