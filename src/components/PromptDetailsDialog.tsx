"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { GenerationMetadata } from "@/lib/generation-history";

interface PromptDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: GenerationMetadata | null;
}

export function PromptDetailsDialog({
  open,
  onOpenChange,
  metadata,
}: PromptDetailsDialogProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (!metadata) {
    return null;
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>プロンプト詳細</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ユーザー入力 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                📝 ユーザー入力
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(metadata.userTheme, "theme")}
              >
                {copiedSection === "theme" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="p-3 bg-muted rounded-md text-sm">
              {metadata.userTheme}
            </div>
          </div>

          {/* アーティスト情報 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              🎨 アーティスト
            </h3>
            <div className="p-3 bg-muted rounded-md text-sm">
              {metadata.artistName}
            </div>
          </div>

          {/* 修正情報（修正の場合のみ） */}
          {metadata.isModification && metadata.modificationInstruction && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  ✏️ 修正指示
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      metadata.modificationInstruction!,
                      "modification"
                    )
                  }
                >
                  {copiedSection === "modification" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="p-3 bg-muted rounded-md text-sm">
                {metadata.modificationInstruction}
              </div>
            </div>
          )}

          {/* アコーディオンで詳細情報 */}
          <Accordion type="single" collapsible className="w-full">
            {/* テーマ解釈 */}
            <AccordionItem value="interpretation">
              <AccordionTrigger className="text-sm font-semibold">
                🔍 テーマ解釈
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Elements (要素)
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            metadata.interpretation.elements,
                            "elements"
                          )
                        }
                      >
                        {copiedSection === "elements" ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="p-2 bg-muted rounded text-xs">
                      {metadata.interpretation.elements}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Mood (雰囲気)
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(metadata.interpretation.mood, "mood")
                        }
                      >
                        {copiedSection === "mood" ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="p-2 bg-muted rounded text-xs">
                      {metadata.interpretation.mood}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 構造化プロンプト */}
            <AccordionItem value="prompt">
              <AccordionTrigger className="text-sm font-semibold">
                ⚙️ 構造化プロンプト
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(metadata.structuredPrompt, "prompt")
                      }
                    >
                      {copiedSection === "prompt" ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          コピー済み
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          コピー
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-3 bg-muted rounded text-xs whitespace-pre-wrap font-mono">
                    {metadata.structuredPrompt}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ネガティブプロンプト */}
            {metadata.negativePrompt && (
              <AccordionItem value="negative">
                <AccordionTrigger className="text-sm font-semibold">
                  🚫 ネガティブプロンプト
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(metadata.negativePrompt, "negative")
                        }
                      >
                        {copiedSection === "negative" ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            コピー済み
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            コピー
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="p-3 bg-muted rounded text-xs whitespace-pre-wrap font-mono">
                      {metadata.negativePrompt}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          {/* 生成日時 */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              📅 生成日時: {formatDate(metadata.timestamp)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              🆔 ID: {metadata.id}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
