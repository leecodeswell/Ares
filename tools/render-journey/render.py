"""Render the journey's flight frame by frame.

    python3 tools/render-journey/render.py [frames-dir] [--frames 240]

Writes <frames-dir>/landscape/f_000.png ... (1920x1080) and
<frames-dir>/portrait/f_000.png ... (864x1536), one per frame at progress
i / (frames - 1). Existing frames are skipped, so an interrupted render
resumes where it stopped. Each frame is rendered larger (--supersample, 1.5x
by default) and scaled down, which smooths edges and fine carving. Uses headless Chromium; on a machine without a GPU
it falls back to SwiftShader (about 20 s a frame on two cores).
"""
import argparse, asyncio, base64, io, os, pathlib, time
from PIL import Image
from playwright.async_api import async_playwright

HERE = pathlib.Path(__file__).resolve().parent
SIZES = {"landscape": (1920, 1080), "portrait": (864, 1536)}


async def main(out, frames, only, supersample):
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=[
            "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist", "--allow-file-access-from-files",
        ])
        page = await browser.new_page()
        page.set_default_timeout(0)
        await page.goto((HERE / "out" / "index.html").as_uri())
        await page.evaluate("window.ready")
        for name, (width, height) in SIZES.items():
            if only and name != only:
                continue
            folder = out / name
            folder.mkdir(parents=True, exist_ok=True)
            for i in range(frames):
                target = folder / f"f_{i:03d}.png"
                if target.exists():
                    continue
                started = time.time()
                big = (round(width * supersample), round(height * supersample))
                await page.evaluate(f"window.renderAt({i / (frames - 1)}, {big[0]}, {big[1]})")
                data = await page.evaluate("document.querySelector('canvas').toDataURL('image/png')")
                image = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1]))).convert("RGB")
                if image.size != (width, height):
                    image = image.resize((width, height), Image.LANCZOS)
                partial = target.with_suffix(".tmp")
                image.save(partial, "PNG")
                os.replace(partial, target)
                print(name, i, f"{time.time() - started:.1f}s", flush=True)
        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("out", nargs="?", default="journey-frames")
    parser.add_argument("--frames", type=int, default=240)
    parser.add_argument("--only", choices=list(SIZES))
    parser.add_argument("--supersample", type=float, default=1.5)
    args = parser.parse_args()
    asyncio.run(main(pathlib.Path(args.out), args.frames, args.only, args.supersample))
