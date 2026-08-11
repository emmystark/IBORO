// src/components/chat/CitationPopover.tsx
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { FileText, Hash } from "lucide-react";
import { Source } from "@/types";

interface CitationPopoverProps {
  index: number;
  source: Source;
}

export default function CitationPopover({ index, source }: CitationPopoverProps) {
  const fileName = source.source.split("/").pop() || source.source;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs font-medium border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all"
        >
          <Hash className="w-3 h-3 mr-1" />
          {index}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-4" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            <Badge variant="secondary" className="text-xs">
              Source {index}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">{fileName}</p>
            {source.page !== undefined && (
              <p className="text-emerald-400">Page {source.page + 1}</p>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-sm leading-relaxed text-foreground italic">
              “{source.text.trim()}”
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}