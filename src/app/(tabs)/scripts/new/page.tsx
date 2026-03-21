"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardPaste,
  Upload,
  Sparkles,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useUser } from "@/hooks/use-user";

export default function NewScriptPage() {
  const router = useRouter();
  const { userId } = useUser();
  const parseScript = useAction(api.actions.parseScript);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const handleParse = async () => {
    if (!content.trim() || !name.trim() || !userId) return;

    setIsParsing(true);
    try {
      const result = await parseScript({
        name,
        content,
        userId,
      });
      router.push(`/scripts/${result.scriptId}`);
    } catch {
      // Handle error
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setContent(text);
    if (!name) {
      setName(file.name.replace(/\.[^.]+$/, ""));
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/scripts">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Add Script</h1>
      </div>

      {/* Name */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Script Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Hotel Sales Script v4"
          className="bg-card/30"
        />
      </div>

      {/* Content */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Script Content
        </label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your full script here..."
          className="min-h-[200px] resize-none bg-card/30 font-mono text-sm"
        />
      </div>

      {/* Upload Option */}
      <div className="mb-6 flex gap-3">
        <label className="flex-1">
          <input
            type="file"
            accept=".txt,.pdf,.docx,.md"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Card className="flex cursor-pointer items-center justify-center gap-2 border-border/30 bg-card/20 p-3 text-sm text-muted-foreground transition-colors hover:bg-card/40">
            <Upload className="h-4 w-4" />
            Upload File
          </Card>
        </label>
        <button
          onClick={async () => {
            const text = await navigator.clipboard.readText();
            setContent(text);
          }}
          className="flex-1"
        >
          <Card className="flex cursor-pointer items-center justify-center gap-2 border-border/30 bg-card/20 p-3 text-sm text-muted-foreground transition-colors hover:bg-card/40">
            <ClipboardPaste className="h-4 w-4" />
            Paste from Clipboard
          </Card>
        </button>
      </div>

      {/* Parse Button */}
      <Button
        onClick={handleParse}
        disabled={!content.trim() || !name.trim() || isParsing || !userId}
        className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
      >
        {isParsing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing script...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Let AI Structure This
          </>
        )}
      </Button>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        AI will detect phases, scenarios, and expected responses
      </p>
    </div>
  );
}
