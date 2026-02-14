#!/usr/bin/env python3
"""Process extracted frames: crop browser UI and pad to 4:3 with background."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


SRC_DIR = Path("output/video_analysis_5sec")
DEST_DIR = Path("output/video_analysis_5sec_processed")

# Crop settings based on inspection of frame_0001.png
# Original size: 1640x2360
# Remove browser UI at top by cropping 260px from top.
CROP_TOP = 260

# Output target (4:3) based on cropped height 2100 -> width 2800
TARGET_HEIGHT = 2100
TARGET_WIDTH = 2800

# Background colors
BG_COLOR_DEFAULT = (238, 242, 248)  # #EEF2F8
BG_COLOR_A = (248, 232, 240)  # #F8E8F0 (淡いピンク)
BG_COLOR_B = (232, 248, 236)  # #E8F8EC (淡い緑)


def background_for_frame(frame_name: str) -> tuple[int, int, int]:
    # A: frame_0001,0004,0005,0006,0011,0014
    # B: frame_0016,0020,0024
    if frame_name in {
        "frame_0001.png",
        "frame_0004.png",
        "frame_0005.png",
        "frame_0006.png",
        "frame_0011.png",
        "frame_0014.png",
    }:
        return BG_COLOR_A
    if frame_name in {"frame_0016.png", "frame_0020.png", "frame_0024.png"}:
        return BG_COLOR_B
    return BG_COLOR_DEFAULT


def process_image(path: Path) -> None:
    img = Image.open(path)
    width, height = img.size
    if height <= CROP_TOP:
        raise ValueError(f"Image too short to crop: {path} ({width}x{height})")

    cropped = img.crop((0, CROP_TOP, width, height))
    cropped_width, cropped_height = cropped.size

    # Ensure target dimensions are consistent with 4:3 output
    target_width = TARGET_WIDTH
    target_height = TARGET_HEIGHT

    if cropped_height != TARGET_HEIGHT:
        # Keep consistent height by fitting to TARGET_HEIGHT if needed
        target_height = cropped_height
        target_width = int(round(target_height * 4 / 3))

    if cropped_width > target_width:
        raise ValueError(
            f"Cropped width {cropped_width} exceeds target width {target_width}"
        )

    # Create background canvas
    bg_color = background_for_frame(path.name)
    canvas = Image.new("RGB", (target_width, target_height), bg_color)

    # Center the cropped image horizontally and vertically
    x = (target_width - cropped_width) // 2
    y = (target_height - cropped_height) // 2
    canvas.paste(cropped, (x, y))

    DEST_DIR.mkdir(parents=True, exist_ok=True)
    out_path = DEST_DIR / path.name
    canvas.save(out_path)


def main() -> None:
    if not SRC_DIR.exists():
        raise SystemExit(f"Source directory not found: {SRC_DIR}")

    images = sorted(SRC_DIR.glob("frame_*.png"))
    if not images:
        raise SystemExit(f"No frames found in {SRC_DIR}")

    for image_path in images:
        process_image(image_path)

    print(f"Processed {len(images)} frames -> {DEST_DIR}")


if __name__ == "__main__":
    main()
