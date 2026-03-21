"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardPaste,
  Upload,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";

interface EditScriptPageProps {
  params: Promise<{ id: string }>;
}

export default function EditScriptPage({ params }: EditScriptPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const script = useQuery(api.scripts.get, {
    id: id as Id<"scripts">,
  });
  const updateScript = useAction(api.actions.updateScript);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Pre-fill from existing script data
  useEffect(() => {
    if (script && !prefilled) {
      setName(script.name);
      setContent(script.rawContent ?? "");
      setPrefilled(true);
    }
  }, [script, prefilled]);

  const handleUpdate = async () => {
    if (!content.trim() || !name.trim()) return;

    setIsParsing(true);
    setError(null);
    try {
      await updateScript({
        id: id as Id<"scripts">,
        name,
        content,
      });
      router.push(`/scripts/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update script");
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

  if (script === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (script === null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-sm text-muted-foreground">Script not found</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/scripts/${id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Edit Script</h1>
      </div>

      {/* Warning */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
        <p className="text-xs leading-relaxed text-amber-200/80">
          This will re-analyze your script. Existing practice data stays.
        </p>
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

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Update Button */}
      <Button
        onClick={handleUpdate}
        disabled={!content.trim() || !name.trim() || isParsing}
        className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
      >
        {isParsing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Re-analyzing script...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Update Script
          </>
        )}
      </Button>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        AI will re-detect phases, scenarios, and expected responses
      </p>
    </div>
  );
}
