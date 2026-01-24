"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

interface ThemeInputProps {
  theme: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  uploadedImage: string | null;
  onImageUpload: (imageBase64: string) => void;
  onImageClear: () => void;
}

export function ThemeInput({
  theme,
  onChange,
  disabled,
  uploadedImage,
  onImageUpload,
  onImageClear,
}: ThemeInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    // ファイルサイズチェック（10MB制限）
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ファイルサイズは10MB以下にしてください");
      return;
    }

    // 画像形式チェック
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }

    // Base64に変換
    const reader = new FileReader();
    reader.onload = () => {
      onImageUpload(reader.result as string);
      toast.success("画像をアップロードしました");
    };
    reader.onerror = () => {
      toast.error("アップロードに失敗しました");
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">テーマ</CardTitle>
        <CardDescription className="text-xs">
          描いてほしいテーマを入力してください
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder={
            uploadedImage
              ? "例: 左の人だけ写楽風にして、背景を夜にして..."
              : "例: 夕暮れの富士山、猫と月、雨上がりのパリの街角..."
          }
          value={theme}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className="resize-none"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        />

        {/* 画像アップロード状態表示 */}
        {uploadedImage ? (
          <div className="flex items-center gap-3 p-2 bg-primary/10 rounded-md">
            <img
              src={uploadedImage}
              alt="アップロード画像"
              className="h-16 w-16 object-cover rounded border border-primary/20"
            />
            <div className="flex-1">
              <p className="text-sm text-primary font-medium">画像をアップロード済み</p>
              <p className="text-xs text-muted-foreground">追加指示を入力できます</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onImageClear}
              disabled={disabled}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="text-xs"
            >
              <Upload className="h-3 w-3 mr-1" />
              画像を選択
            </Button>
            <span className="text-xs text-muted-foreground">
              またはドラッグ&ドロップ
            </span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        <p className="text-xs text-muted-foreground">
          {uploadedImage
            ? "画像に対する追加指示を入力できます"
            : "0 / 500"}
        </p>
      </CardContent>
    </Card>
  );
}
