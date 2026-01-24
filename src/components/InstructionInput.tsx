"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface InstructionInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function InstructionInput({ value, onChange, disabled }: InstructionInputProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">追加指示（オプション）</CardTitle>
        <CardDescription className="text-xs">
          部分的な変更も指示できます
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="例: 左の人だけ写楽風にして"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground mt-2">
          空欄の場合、画像全体を変換します
        </p>
      </CardContent>
    </Card>
  );
}
