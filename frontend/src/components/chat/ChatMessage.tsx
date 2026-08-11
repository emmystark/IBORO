import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Message } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";
import CitationPopover from "./CitationPopover";
import { format, formatDistanceToNow } from "date-fns";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [, setNow] = useState(new Date());

  // Update time every 30 seconds so "5 minutes ago" stays fresh
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Live relative time (e.g., "2 minutes ago", "1 hour ago")
  const relativeTime = message.timestamp
    ? formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })
    : "just now";

  // Exact time for hover or fallback
  const exactTime = message.timestamp
    ? format(new Date(message.timestamp), "h:mm a")
    : "now";

  return (
    <div
      className={`flex gap-4 ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      {/* Assistant Avatar + Live Time */}
      {message.role === "assistant" && (
        <div className="flex flex-col items-center gap-1.5">
          <Avatar className="shrink-0">
            <AvatarFallback className="bg-emerald-500 text-black">
              <Bot className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-500 whitespace-nowrap" title={exactTime}>
            {relativeTime}
          </span>
        </div>
      )}

      {/* Message Bubble */}
      <div className={`max-w-2xl ${message.role === "user" ? "order-last" : ""}`}>
        <Card
          className={`p-4 shadow-lg border ${
            message.role === "user"
              ? "bg-black text-white border-emerald-500"
              : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
          }`}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Citations */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
              {message.sources.map((src, i) => (
                <CitationPopover key={i} index={i + 1} source={src} />
              ))}
            </div>
          )}

          {/* Copy Button */}
          {message.role === "assistant" && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 h-8 px-2 text-xs"
              onClick={copyToClipboard}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 mr-1" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </>
              )}
            </Button>
          )}
        </Card>
      </div>

      {/* User Avatar + Live Time */}
      {message.role === "user" && (
        <div className="flex flex-col items-center gap-1.5">
          <Avatar className="shrink-0">
            <AvatarFallback className="bg-black text-emerald-500">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-500 whitespace-nowrap" title={exactTime}>
            {relativeTime}
          </span>
        </div>
      )}
    </div>
  );
}