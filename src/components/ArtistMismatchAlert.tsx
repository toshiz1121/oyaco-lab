"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { artists } from "@/lib/artists";

interface ArtistMismatchAlertProps {
  currentArtistId: string;
  selectedArtistId: string;
  onRemix: () => void;
  isRemixing?: boolean;
}

export function ArtistMismatchAlert({
  currentArtistId,
  selectedArtistId,
  onRemix,
  isRemixing = false,
}: ArtistMismatchAlertProps) {
  const currentArtist = artists.find((a) => a.id === currentArtistId);
  const selectedArtist = artists.find((a) => a.id === selectedArtistId);

  if (currentArtistId === selectedArtistId) return null;

  return (
    <Alert className="mt-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        巨匠が異なります
      </AlertTitle>
      <AlertDescription>
        <p className="text-sm mb-3 text-amber-800 dark:text-amber-200">
          現在の作品: <span className="font-semibold">{currentArtist?.name}</span>
          <br />
          選択中: <span className="font-semibold">{selectedArtist?.name}</span>
        </p>
        <Button
          onClick={onRemix}
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={isRemixing}
        >
          {isRemixing
            ? "リミックス中..."
            : `${selectedArtist?.name}の画風で描き直す`}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
