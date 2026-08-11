"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Preloader } from "@/components/Preloader";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    router.replace(token ? "/chat" : "/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
      <Preloader messages={[]} fullscreen={false} />
    </div>
  );
}
