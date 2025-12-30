"use client";

import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function WidgetChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [greeting, setGreeting] = useState("Hi! How can I help you today?");
  const [assistantAvatarUrl, setAssistantAvatarUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [themePreset, setThemePreset] = useState<"minimal" | "bold" | "clean" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get theme preset styles
  const getThemePresetStyles = (preset: typeof themePreset) => {
    switch (preset) {
      case "minimal":
        return {
          container: "rounded-lg shadow-sm",
          header: "border-b border-opacity-30",
          spacing: "p-3",
        };
      case "bold":
        return {
          container: "rounded-xl shadow-lg",
          header: "border-b-2",
          spacing: "p-4",
        };
      case "clean":
      default:
        return {
          container: "rounded-lg shadow-md",
          header: "border-b",
          spacing: "p-3",
        };
    }
  };
  
  const themeStyles = getThemePresetStyles(themePreset);

  // Helper function to get initials from business name
  const getInitials = (name: string): string => {
    if (!name || !name.trim()) {
      return "AI";
    }
    
    const words = name.trim().split(/\s+/).filter((w) => w.length > 0);
    
    if (words.length === 0) {
      return "AI";
    }
    
    if (words.length === 1) {
      // Single word: take first 1-2 letters
      const first = words[0];
      return first.substring(0, Math.min(2, first.length)).toUpperCase();
    }
    
    // Multiple words: take first letter of first two words
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  // Get params from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bid = params.get("businessId");
    const k = params.get("key");
    const g = params.get("greeting");
    const avatar = params.get("avatar");
    const name = params.get("name"); // Optional business name for initials
    
    setBusinessId(bid);
    setKey(k);
    
    // Get greeting and avatar from URL params (passed by widget script)
    if (g) {
      setGreeting(decodeURIComponent(g));
    }
    if (avatar) {
      setAssistantAvatarUrl(decodeURIComponent(avatar));
      setAvatarLoadError(false); // Reset error when URL changes
    }
    if (name) {
      setBusinessName(decodeURIComponent(name));
    }
    
    // Load theme preset from localStorage
    if (bid) {
      try {
        const stored = localStorage.getItem(`aiHelpDesk:widget:themePreset:${bid}`);
        if (stored) {
          const parsed = JSON.parse(stored) as typeof themePreset;
          setThemePreset(parsed);
        }
      } catch {
        // Silently fail
      }
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !businessId || !key) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-help-desk/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          key,
          message: userMessage.content,
          threadId,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to get response");
      }

      if (json.data.threadId) {
        setThreadId(json.data.threadId);
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: json.data.answer || "I couldn't find that in the help desk knowledge.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Send message to parent window to close iframe
    if (window.parent) {
      window.parent.postMessage("ai-help-desk-close", "*");
    }
  };

  if (!businessId || !key) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <p className="text-slate-600">Invalid widget configuration</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white ${themeStyles.container}`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 ${themeStyles.header} bg-slate-50`}>
        <div className="flex items-center gap-3">
          {assistantAvatarUrl && !avatarLoadError ? (
            <img
              src={assistantAvatarUrl}
              alt="Chat assistant avatar"
              className="w-8 h-8 rounded-full object-cover"
              onError={() => {
                setAvatarLoadError(true);
              }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs bg-gradient-to-br from-[#29c4a9] to-[#1ea085]"
              aria-label="Assistant avatar initials"
            >
              {getInitials(businessName)}
            </div>
          )}
          <h2 className="text-lg font-semibold text-slate-900">Help Desk</h2>
        </div>
        <button
          onClick={handleClose}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClose();
            }
          }}
          className="text-slate-500 hover:text-slate-700 text-xl leading-none"
          aria-label="Close chat widget"
          type="button"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div 
        className={`flex-1 overflow-y-auto ${themeStyles.spacing} space-y-4`}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-600">{greeting}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0">
                  {assistantAvatarUrl && !avatarLoadError ? (
                    <img
                      src={assistantAvatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                      onError={() => {
                        setAvatarLoadError(true);
                      }}
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs bg-gradient-to-br from-[#29c4a9] to-[#1ea085]"
                      aria-label="Assistant avatar initials"
                    >
                      {getInitials(businessName)}
                    </div>
                  )}
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-[#29c4a9] text-white"
                    : "bg-slate-100 text-slate-900"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-start gap-2 justify-start">
            {assistantAvatarUrl && !avatarLoadError ? (
              <img
                src={assistantAvatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                onError={() => {
                  setAvatarLoadError(true);
                }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs bg-gradient-to-br from-[#29c4a9] to-[#1ea085] flex-shrink-0"
                aria-label="Assistant avatar initials"
              >
                {getInitials(businessName)}
              </div>
            )}
            <div className="bg-slate-100 rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t bg-slate-50">
        {error && (
          <p className="text-xs text-red-600 mb-2">{error}</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#29c4a9]"
            disabled={loading}
            aria-label="Chat message input"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-2 bg-[#29c4a9] text-white rounded-lg font-medium hover:bg-[#24b39a] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

