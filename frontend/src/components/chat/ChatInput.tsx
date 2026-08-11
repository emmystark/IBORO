"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { useState } from "react";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSubmit(input);
    setInput("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 p-6 bg-background border-t">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask anything about the company documents..."
        className="flex-1 border-none text-base bg-white"
        disabled={disabled}
      />
      <Button
        type="submit"
        disabled={!input.trim() || disabled}
        className="bg-emerald-500 hover:bg-emerald-600 text-black font-medium"
      >
        {disabled ? "Thinking..." : <Send className="w-5 h-5" />}
      </Button>
    </form>
  );
}