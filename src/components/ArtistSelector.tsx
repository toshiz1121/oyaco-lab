"use client";

import { artists } from "@/lib/artists";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface ArtistSelectorProps {
  selectedArtistId: string | null;
  onSelect: (artistId: string) => void;
  disabledArtists?: string[];
}

export function ArtistSelector({ selectedArtistId, onSelect, disabledArtists = [] }: ArtistSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">巨匠</Label>
      <div className="grid grid-cols-4 gap-2">
        {artists.map((artist) => {
          const isDisabled = disabledArtists.includes(artist.id);
          return (
            <button
              key={artist.id}
              className={cn(
                "aspect-square rounded-lg overflow-hidden border-2 transition-all",
                "hover:scale-105",
                isDisabled && "opacity-50 cursor-not-allowed",
                selectedArtistId === artist.id
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-transparent hover:border-primary/50"
              )}
              onClick={() => !isDisabled && onSelect(artist.id)}
              disabled={isDisabled}
              title={`${artist.name} - ${artist.style}`}
            >
              <div className="relative w-full h-full">
                {/* 画風パターン（外側） */}
                <Image
                  src={`/avatars/patterns/${artist.id}.png`}
                  alt={`${artist.name} pattern`}
                  fill
                  sizes="(max-width: 768px) 25vw, (max-width: 1024px) 20vw, 15vw"
                  className="object-cover"
                />
                {/* 人物アバター（内側） */}
                <div className="absolute inset-1 rounded-full overflow-hidden border-2 border-white bg-white">
                  {artist.thumbnailUrl ? (
                    <Image
                      src={artist.thumbnailUrl}
                      alt={artist.name}
                      fill
                      sizes="(max-width: 768px) 20vw, (max-width: 1024px) 15vw, 12vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      No Image
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
