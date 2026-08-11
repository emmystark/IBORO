"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ChatInput({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    onSubmit(input);
    setInput("");
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask anything about the company docs..."
        disabled={loading}
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Thinking..." : "Send"}
      </Button>
    </form>
  );
}