#!/bin/sh
# Encode rendered frames into the videos the site scrubs through.
#   tools/render-journey/encode.sh [frames-dir]
# A keyframe every 4 frames and no B-frames keep seeking cheap in both
# directions; H.264 for hardware decoding everywhere, VP9 WebM for browsers
# without H.264. Poster stills are the first frame (poster-<shape>.webp).
# Every frame is mirrored left to right: the scene is built with its wall on
# the right, and the site shows it on the left, behind the words.
set -e
frames=${1:-journey-frames}
out=public/journey
mkdir -p "$out"
# Phones get a lighter portrait encode; their screens hide the difference.
for shape in landscape portrait; do
  if [ "$shape" = landscape ]; then h264=21; vp9=33; else h264=24; vp9=36; fi
  ffmpeg -loglevel error -y -framerate 24 -i "$frames/$shape/f_%03d.png" -vf hflip \
    -c:v libx264 -preset veryslow -tune film -crf $h264 -g 4 -keyint_min 4 -bf 0 -sc_threshold 0 \
    -pix_fmt yuv420p -movflags +faststart -an "$out/flight-$shape.mp4"
  ffmpeg -loglevel error -y -framerate 24 -i "$frames/$shape/f_%03d.png" -vf hflip \
    -c:v libvpx-vp9 -b:v 0 -crf $vp9 -g 4 -keyint_min 4 -auto-alt-ref 0 -lag-in-frames 0 \
    -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p -an "$out/flight-$shape.webm"
  python3 -c "from PIL import Image; Image.open('$frames/$shape/f_000.png').convert('RGB').transpose(Image.FLIP_LEFT_RIGHT).save('$out/poster-$shape.webp', quality=84, method=6)"
done
ls -l "$out"
