# Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
# brennanmmeyer@gmail.com
# B9 photo-core fixtures (docs/UX-BEGINNER.md 4.4, section 10 B9): the three phone photos of the
# B8 + B9 first-timer walk (IMG_4127 first try, IMG_4131 notebook alphabet, IMG_4133 one g), whose
# shadows, smudges, punch holes, ruled and margin lines became parts. make_firsttimer.mjs runs
# this, stores each photo the way the app does (Chrome) and writes the answer keys.
# Felt-tip hand from Windows' Ink Free font, each letter turned, sized and placed by a shaky
# hand; the page on a wood desk, tilted and in perspective, light falling off, a hand/phone
# shadow across one corner, sensor noise, slight blur, JPEG with the EXIF fields an iPhone
# writes (Make, Model, exposure, f-number, ISO, focal length, Orientation).
# Usage: python firsttimer_photos.py <out folder>   (needs Pillow, NumPy and Windows' Ink Free)
import io
import math
import random
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT.mkdir(parents=True, exist_ok=True)
FONT = 'C:/Windows/Fonts/Inkfree.ttf'
DPI = 300  # the flat page is drawn at 300 px per inch (8.5 x 11 in = 2550 x 3300)
INK = (28, 27, 34)


def letter_layer(ch, cap_px, rng, pen_grow=5):
    """One letter as an L mask (255 = ink), its baseline row and ink box."""
    size = int(cap_px / 0.70)  # Ink Free's capitals are about 70% of its size
    font = ImageFont.truetype(FONT, size)
    pad = size
    img = Image.new('L', (size * 2 + pad, size * 2 + pad), 0)
    d = ImageDraw.Draw(img)
    ascent, _ = font.getmetrics()
    d.text((pad // 2, pad // 2), ch, font=font, fill=255)
    base = pad // 2 + ascent
    img = img.filter(ImageFilter.MaxFilter(pen_grow))  # a felt tip is fatter than the font
    angle = rng.uniform(-6, 6)
    img = img.rotate(angle, resample=Image.BICUBIC, center=(img.width / 2, base))
    img = img.filter(ImageFilter.GaussianBlur(0.9))
    box = img.getbbox()
    return img, base, box


def write_row(page_mask, text, x0, base_y, cap_px, gap_px, rng, specials=None):
    """Writes letters left to right on a baseline; returns each letter's ink box on the page."""
    specials = specials or {}
    x = x0
    boxes = []
    for i, ch in enumerate(text):
        if ch == ' ':
            x += gap_px
            continue
        sp = specials.get(i, {})
        scale = sp.get('scale', rng.uniform(0.86, 1.18))
        img, base, box = letter_layer(ch, cap_px * scale, rng)
        if box is None:
            continue
        crop = img.crop(box)
        dy = sp.get('dy', rng.uniform(-0.06, 0.06) * cap_px)
        y = int(base_y - (base - box[1]) + dy)
        gx = x + sp.get('dx', 0)
        region = page_mask.crop((int(gx), y, int(gx) + crop.width, y + crop.height))
        page_mask.paste(Image.fromarray(np.maximum(np.array(region), np.array(crop))), (int(gx), y))
        boxes.append({'char': ch, 'box': [int(gx), y, int(gx) + crop.width, y + crop.height]})
        x = gx + crop.width + sp.get('gap', gap_px * rng.uniform(0.8, 1.25))
    return boxes, x


def scribble(page_mask, box, rng, pen=11):
    """A crossed-out mistake: a zigzag scribble over a box."""
    d = ImageDraw.Draw(page_mask)
    x0, y0, x1, y1 = box
    pts = []
    n = 9
    for k in range(n):
        y = y0 + (y1 - y0) * k / (n - 1) + rng.uniform(-8, 8)
        pts.append((x0 + rng.uniform(-10, 15), y))
        pts.append((x1 + rng.uniform(-15, 10), y + (y1 - y0) / (2 * n)))
    d.line(pts, fill=255, width=pen, joint='curve')
    d.line([(x0 - 10, y1 + 6), (x1 + 14, y0 - 4)], fill=255, width=pen)


def smudge(page, center, radius, strength):
    """A gray finger smear of ink (multiplies the page darker)."""
    w, h = page.size
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = center
    # an elongated smear at an angle
    a = math.radians(25)
    u = (xx - cx) * math.cos(a) + (yy - cy) * math.sin(a)
    v = -(xx - cx) * math.sin(a) + (yy - cy) * math.cos(a)
    r = np.sqrt((u / (radius * 1.8)) ** 2 + (v / radius) ** 2)
    f = np.clip(1 - r, 0, 1) ** 1.6 * strength
    arr = np.array(page).astype(np.float32)
    arr *= (1 - f[..., None])
    arr += f[..., None] * np.array(INK, dtype=np.float32) * 1.4
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def blank_page(lined, rng):
    w, h = int(8.5 * DPI), int(11 * DPI)
    paper = np.full((h, w, 3), (246, 245, 240), dtype=np.float32)
    paper += rng.normal(0, 2.0, (h, w, 1)).astype(np.float32)
    img = Image.fromarray(np.clip(paper, 0, 255).astype(np.uint8))
    if lined:
        d = ImageDraw.Draw(img)
        top = int(1.0 * DPI)
        step = int(round(11 / 32 * DPI))  # wide ruled
        y = top
        while y < h - int(0.4 * DPI):
            d.line([(0, y), (w, y)], fill=(150, 182, 222), width=4)
            y += step
        mx = int(1.25 * DPI)
        d.line([(mx, 0), (mx, h)], fill=(226, 140, 150), width=5)
        for hy in (int(1.6 * DPI), int(5.5 * DPI), int(9.4 * DPI)):  # three-hole punch
            d.ellipse([int(0.35 * DPI), hy - 40, int(0.35 * DPI) + 80, hy + 40], fill=(110, 84, 60))
    return img


def ink_onto(page, mask):
    arr = np.array(page).astype(np.float32)
    m = (np.array(mask).astype(np.float32) / 255.0)[..., None]
    ink = np.array(INK, dtype=np.float32)
    # a felt tip is not perfectly even: tiny density wobble
    arr = arr * (1 - m * 0.97) + ink * m * 0.97
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def perspective_coeffs(dst, src):
    """PIL PERSPECTIVE coefficients mapping output points (dst) to input points (src)."""
    A = []
    B = []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        B += [u, v]
    return np.linalg.solve(np.array(A, dtype=np.float64), np.array(B, dtype=np.float64)).tolist()


def wood(w, h, rng):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    grain = np.sin(xx / 37.0 + np.sin(yy / 230.0) * 3.0) * 0.5 + 0.5
    base = np.stack([128 + 30 * grain, 92 + 22 * grain, 60 + 12 * grain], axis=-1)
    base += rng.normal(0, 4, (h, w, 1))
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))


def photograph(page, frame, corners, shadow_poly, light_from, rng, blur=1.3):
    """The page on a desk, in perspective, lit unevenly with a shadow, as a phone sees it."""
    W, H = frame
    desk = wood(W, H, rng)
    pw, ph = page.size
    coeffs = perspective_coeffs(corners, [(0, 0), (pw, 0), (pw, ph), (0, ph)])
    warped = page.transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=(0, 0, 0))
    mask = Image.new('L', (pw, ph), 255).transform((W, H), Image.PERSPECTIVE, coeffs, Image.BILINEAR, fillcolor=0)
    img = Image.composite(warped, desk, mask)
    arr = np.array(img).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    lx, ly = light_from
    dist = np.sqrt(((xx - lx) / W) ** 2 + ((yy - ly) / H) ** 2)
    light = 1.04 - 0.30 * np.clip(dist, 0, 1.4) / 1.4  # falls off away from the window
    sh = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sh).polygon(shadow_poly, fill=255)
    sh = sh.filter(ImageFilter.GaussianBlur(70))
    shadow = 1 - 0.42 * (np.array(sh).astype(np.float32) / 255.0)
    arr *= (light * shadow)[..., None]
    # warm indoor white balance
    arr *= np.array([1.0, 0.97, 0.90], dtype=np.float32)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))
    arr = np.array(img).astype(np.float32)
    arr += rng.normal(0, 3.2, arr.shape).astype(np.float32)  # sensor noise
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def iphone_exif(orientation):
    """A minimal TIFF/EXIF block like an iPhone writes: Make, Model, Orientation, Exif IFD."""
    ex = Image.Exif()
    ex[0x010F] = 'Apple'
    ex[0x0110] = 'iPhone 13'
    ex[0x0112] = orientation
    ex[0x0131] = '17.5.1'
    ifd = ex.get_ifd(0x8769)
    ifd[0x829A] = 1 / 60  # ExposureTime
    ifd[0x829D] = 1.6  # FNumber
    ifd[0x8827] = 400  # ISO
    ifd[0x920A] = 5.1  # FocalLength
    ifd[0x9003] = '2026:10:15 14:12:09'
    return ex.tobytes()


def save(img, name, orientation=1, quality=88):
    path = OUT / name
    img.save(path, 'JPEG', quality=quality, exif=iphone_exif(orientation), subsampling=2)
    print(name, img.size, f'{path.stat().st_size / 1e6:.1f} MB')
    return path


# ---------------------------------------------------------------------------
# Photo 1: the How card's first try, B r e n a H d, plain printer paper, landscape phone
# photo, page tilted, desk showing at the top right, shadow over the bottom left corner,
# letters of uneven size, n touching a, a smudge by the e, a little pen tick.
# ---------------------------------------------------------------------------
def photo_first_try():
    rng = random.Random(41)
    nrng = np.random.default_rng(41)
    page = blank_page(False, nrng)
    mask = Image.new('L', page.size, 0)
    cap = int(1.0 * DPI)  # about 1 inch tall capitals
    specials = {
        0: {'scale': 1.15},  # a big B
        1: {'scale': 0.72},  # small r, small and thin
        3: {'gap': -10},  # n runs into a
        4: {'scale': 0.95},
        6: {'scale': 1.25, 'dy': -20},  # big H, a bit above the line
        7: {'scale': 1.0},
    }
    boxes, _ = write_row(mask, 'Brena Hd', int(0.7 * DPI), int(2.6 * DPI), int(0.95 * DPI), int(0.42 * DPI), rng, specials)
    # pen tick near the d
    d = ImageDraw.Draw(mask)
    d.line([(boxes[-1]['box'][2] + 60, int(2.6 * DPI) - 30), (boxes[-1]['box'][2] + 85, int(2.6 * DPI) - 50)], fill=255, width=9)
    page = ink_onto(page, mask.filter(ImageFilter.GaussianBlur(0.6)))
    e = next(b for b in boxes if b['char'] == 'e')['box']
    page = smudge(page, ((e[0] + e[2]) // 2 + 40, e[3] + 80), 85, 0.30)
    W, H = 4032, 3024
    # the page fills most of the frame, turned about 3 degrees, keystoned a little
    corners = [(250, -260), (3830, -120), (3990, 4600), (40, 4520)]
    shadow = [(0, 1900), (900, 2300), (1500, 3024), (0, 3024)]
    img = photograph(page, (W, H), corners, shadow, (W * 0.9, -H * 0.2), nrng)
    save(img, 'IMG_4127.JPG')
    meta = {'frame': [W, H], 'page': list(page.size), 'corners': corners, 'turn': 0,
            'smudges': [{'center': [(e[0] + e[2]) // 2 + 40, e[3] + 80], 'radius': 85}],
            'shadow': shadow, 'touching': ['na']}
    return boxes, meta


# ---------------------------------------------------------------------------
# Photo 2: the whole alphabet on wide-ruled notebook paper, held portrait (stored sideways with
# EXIF Orientation 6, as phones do), page tilted the other way, shadow over the top right, uneven
# sizes, touching pairs (V and W, l and m), a crossed-out mistake, a smudge, punch holes.
# ---------------------------------------------------------------------------
def photo_alphabet():
    rng = random.Random(7)
    nrng = np.random.default_rng(7)
    page = blank_page(True, nrng)
    mask = Image.new('L', page.size, 0)
    step = int(round(11 / 32 * DPI))
    top = int(1.0 * DPI)
    cap = int(2 * step * 0.92)  # capitals two rules tall (about 0.63 in)
    x0 = int(1.45 * DPI)
    cap = int(0.6 * DPI)
    gap = int(0.25 * DPI)
    rows = [
        ('ABCDEFG', {}),
        ('HIJKLMN', {}),
        ('OQPQRST', {1: {'scale': 1.0}}),  # wrote Q too early: crossed out below
        ('UVWXYZ', {1: {'gap': -22}}),  # V touches W
        ('abcdefghi', {5: {'scale': 1.3}}),
        ('jklmnopqr', {2: {'gap': -14}, 7: {'scale': 0.78}}),  # l touches m
        ('stuvwxyz', {}),
        (".,'?!-", {}),
    ]
    all_boxes = []
    base = top + 3 * step
    for text, sp in rows:
        boxes, _ = write_row(mask, text, x0, base, cap, gap, rng, sp)
        all_boxes.append(boxes)
        base += 3 * step
    # cross out the early Q in row 2 (index 6)
    q = all_boxes[2][1]['box']
    scribble(mask, (q[0] - 6, q[1] + 10, q[2] + 6, q[3] - 4), rng)
    page = ink_onto(page, mask.filter(ImageFilter.GaussianBlur(0.6)))
    g = all_boxes[4][6]['box']
    page = smudge(page, (g[2] + 70, g[1] + 40), 80, 0.32)
    W, H = 3024, 4032
    corners = [(120, 150), (2960, 30), (3020, 3960), (60, 4030)]
    shadow = [(1700, 0), (3024, 0), (3024, 1500), (2500, 900)]
    img = photograph(page, (W, H), corners, shadow, (-W * 0.2, H * 1.1), nrng)
    stored = img.transpose(Image.Transpose.ROTATE_90)  # sensor-sideways, EXIF says turn it
    save(stored, 'IMG_4131.JPG', orientation=6)
    holes = [[int(0.35 * DPI) + 40, hy] for hy in (int(1.6 * DPI), int(5.5 * DPI), int(9.4 * DPI))]
    meta = {'frame': [W, H], 'page': list(page.size), 'corners': corners, 'turn': 0,
            'smudges': [{'center': [g[2] + 70, g[1] + 40], 'radius': 80}], 'shadow': shadow,
            'holes': holes, 'marginX': int(1.25 * DPI), 'touching': ['VW', 'lm'],
            'crossedOut': [2, 1]}
    return all_boxes, meta


# ---------------------------------------------------------------------------
# Photo 3: a quick single-letter photo: one small g, phone held close, some desk at the edge.
# ---------------------------------------------------------------------------
def photo_single_g():
    rng = random.Random(3)
    nrng = np.random.default_rng(3)
    page = blank_page(False, nrng)
    mask = Image.new('L', page.size, 0)
    boxes, _ = write_row(mask, 'g', int(2.5 * DPI), int(4.0 * DPI), int(1.2 * DPI), 0, rng, {0: {'scale': 1.4}})
    page = ink_onto(page, mask.filter(ImageFilter.GaussianBlur(0.6)))
    page = page.crop((int(1.0 * DPI), int(1.5 * DPI), int(6.5 * DPI), int(6.3 * DPI)))
    W, H = 3024, 4032
    corners = [(-300, -200), (3300, -100), (3200, 4300), (-200, 4200)]
    shadow = [(0, 3000), (3024, 3500), (3024, 4032), (0, 4032)]
    img = photograph(page, (W, H), corners, shadow, (W * 0.5, -H * 0.5), nrng)
    save(img, 'IMG_4133.JPG')
    # the page was cropped before the photo: page points are relative to the crop
    meta = {'frame': [W, H], 'page': list(page.size), 'corners': corners, 'turn': 0,
            'shadow': shadow, 'offset': [int(1.0 * DPI), int(1.5 * DPI)]}
    return boxes, meta


if __name__ == '__main__':
    b1, m1 = photo_first_try()
    b2, m2 = photo_alphabet()
    b3, m3 = photo_single_g()
    import json
    (OUT / 'boxes.json').write_text(json.dumps({
        'IMG_4127': {'rows': [b1], **m1},
        'IMG_4131': {'rows': b2, **m2},
        'IMG_4133': {'rows': [b3], **m3},
    }, indent=1))
