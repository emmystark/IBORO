import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "@/types";
import ChatMessage from "./ChatMessage";

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <ScrollArea className="flex-1 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8 pb-24 w-'90%'">
        {messages.length === 0 ? (
          <div className="text-center py-20 text-black">
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
      </div>
    </ScrollArea>
  );
}