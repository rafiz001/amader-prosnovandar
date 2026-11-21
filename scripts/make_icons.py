#!/usr/bin/env python3
"""Generate the Tauri icon set (PNG/ICO/ICNS) without external libraries."""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src-tauri" / "icons"

BG = (79, 70, 229)
PAGE = (248, 250, 252)
LINE = (199, 210, 254)
SPINE = (67, 56, 202)


def rounded(x, y, x0, y0, x1, y1, r):
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def sample(x, y, size):
    if not rounded(x, y, 0, 0, size, size, size * 0.22):
        return (0, 0, 0, 0)
    color = BG
    left_page = rounded(x, y, size * 0.22, size * 0.30, size * 0.49, size * 0.70, size * 0.03)
    right_page = rounded(x, y, size * 0.51, size * 0.30, size * 0.78, size * 0.70, size * 0.03)
    if left_page or right_page:
        color = PAGE
    if size * 0.485 <= x <= size * 0.515 and size * 0.30 <= y <= size * 0.70:
        color = SPINE
    for ly in (0.40, 0.48, 0.56):
        y0 = size * ly
        if y0 <= y <= y0 + size * 0.018:
            if size * 0.25 <= x <= size * 0.45 or size * 0.55 <= x <= size * 0.75:
                color = LINE
    return (*color, 255)


def render(size, supersample=4):
    big = size * supersample
    rows = []
    for by in range(big):
        y = (by + 0.5) / supersample
        rows.append([sample((bx + 0.5) / supersample, y, size) for bx in range(big)])
    out = bytearray()
    for y in range(size):
        for x in range(size):
            r = g = b = a = 0
            for dy in range(supersample):
                for dx in range(supersample):
                    pr, pg, pb, pa = rows[y * supersample + dy][x * supersample + dx]
                    r += pr * pa
                    g += pg * pa
                    b += pb * pa
                    a += pa
            if a == 0:
                out.extend((0, 0, 0, 0))
            else:
                out.extend((r // a, g // a, b // a, a // (supersample * supersample)))
    return bytes(out)


def png_bytes(size):
    pixels = render(size)
    raw = b"".join(
        b"\x00" + pixels[y * size * 4 : (y + 1) * size * 4] for y in range(size)
    )

    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pngs = {size: png_bytes(size) for size in (32, 128, 256, 512)}
    (OUT / "32x32.png").write_bytes(pngs[32])
    (OUT / "128x128.png").write_bytes(pngs[128])
    (OUT / "128x128@2x.png").write_bytes(pngs[256])
    (OUT / "icon.png").write_bytes(pngs[512])

    ico = pngs[256]
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(ico), 22)
    (OUT / "icon.ico").write_bytes(header + entry + ico)

    elements = b""
    for kind, size in ((b"ic07", 128), (b"ic08", 256), (b"ic09", 512)):
        data = pngs[size]
        elements += kind + struct.pack(">I", len(data) + 8) + data
    (OUT / "icon.icns").write_bytes(
        b"icns" + struct.pack(">I", len(elements) + 8) + elements
    )

    print("wrote", sorted(p.name for p in OUT.iterdir()))


if __name__ == "__main__":
    main()
