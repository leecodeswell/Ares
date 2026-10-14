#!/bin/sh
# Encode rendered frames into the videos the site scrubs through.
#   tools/render-journey/encode.sh [frames-dir]
# A keyframe every 4 frames and no B-frames keep seeking cheap in both
# directions; H.264 for hardware decoding everywhere, VP9 WebM for browsers
# without H.264. Poster stills are the first frame.
set -e
frames=${1:-journey-frames}
out=public/journey
mkdir -p "$out"
for shape in landscape portrait; do
  ffmpeg -loglevel error -y -framerate 24 -i "$frames/$shape/f_%03d.png" \
    -c:v libx264 -preset veryslow -tune film -crf 21 -g 4 -keyint_min 4 -bf 0 -sc_threshold 0 \
    -pix_fmt yuv420p -movflags +faststart -an "$out/flight-$shape.mp4"
  ffmpeg -loglevel error -y -framerate 24 -i "$frames/$shape/f_%03d.png" \
    -c:v libvpx-vp9 -b:v 0 -crf 33 -g 4 -keyint_min 4 -auto-alt-ref 0 -lag-in-frames 0 \
    -row-mt 1 -deadline good -cpu-used 1 -pix_fmt yuv420p -an "$out/flight-$shape.webm"
done
ls -l "$out"
