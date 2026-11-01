#!/usr/bin/env bash
# Renders both cuts, normalises loudness to -14 LUFS, and makes web versions + posters.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/raw out/final
python3 scripts/sfx.py
for id in WattrixWide WattrixTall; do
  npx remotion render src/index.ts "$id" "out/raw/$id.mp4" --codec=h264 --crf=16 --concurrency=4 --log=error
done
for pair in "WattrixWide:16x9" "WattrixTall:9x16"; do
  id=${pair%%:*}; tag=${pair##*:}
  # Re-encode to limited-range yuv420p: Remotion's JPEG frames come out full range (yuvj420p),
  # which some social platforms render with crushed blacks.
  ffmpeg -loglevel error -y -i "out/raw/$id.mp4" -vf "scale=in_range=full:out_range=tv,format=yuv420p" \
    -c:v libx264 -preset slow -crf 17 -profile:v high -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -af "loudnorm=I=-13:TP=-1.2:LRA=11" -ar 48000 -c:a aac -b:a 192k -movflags +faststart \
    "out/final/wattrix-ad-$tag.mp4"
  ffmpeg -loglevel error -y -i "out/final/wattrix-ad-$tag.mp4" -c:v libvpx-vp9 -b:v 0 -crf 32 -row-mt 1 -deadline good -cpu-used 4 \
    -c:a libopus -b:a 128k "out/final/wattrix-ad-$tag.webm"
done
# Posters: the settled end card, pulled from the finished video.
for tag in 16x9 9x16; do
  ffmpeg -loglevel error -y -ss 21.63 -i "out/final/wattrix-ad-$tag.mp4" -frames:v 1 -q:v 2 "out/final/wattrix-ad-poster-$tag.jpg"
done
ls -la out/final
