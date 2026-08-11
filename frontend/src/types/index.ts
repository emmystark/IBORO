export type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    sources?: Source[];

  };
  
  export type Source = {
    text: string;
    source: string;
    url?: string;
    page?: number;
  };

  
  export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;
  }