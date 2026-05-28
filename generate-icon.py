"""
Generate app icons for the Cholesterol Tracker app.
Produces: icon.png (1024x1024), android-icon-foreground.png (512x512 RGBA),
          android-icon-background.png (512x512), android-icon-monochrome.png (512x512)
Run: python3 generate-icon.py
"""
from PIL import Image, ImageDraw
import math, os

ASSETS = os.path.join(os.path.dirname(__file__), 'assets')

# ─── Palette ───────────────────────────────────────────────────────────────
BG_DARK   = (10, 10, 20)        # #0A0A14
PURPLE    = (108, 99, 255)      # #6C63FF
PURPLE_L  = (140, 130, 255)     # lighter purple
WHITE     = (255, 255, 255)
GREEN     = (0, 196, 140)       # #00C48C
RED_SOFT  = (255, 71, 87)       # #FF4757

def draw_rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + 2*radius, y0 + 2*radius], fill=fill)
    draw.ellipse([x1 - 2*radius, y0, x1, y0 + 2*radius], fill=fill)
    draw.ellipse([x0, y1 - 2*radius, x0 + 2*radius, y1], fill=fill)
    draw.ellipse([x1 - 2*radius, y1 - 2*radius, x1, y1], fill=fill)

def draw_heart(draw, cx, cy, size, fill):
    """Draw a heart shape centered at (cx, cy)."""
    # Heart via two circles + triangle
    r = size * 0.28
    # left circle
    draw.ellipse([cx - size*0.5, cy - size*0.18, cx, cy + size*0.18], fill=fill)
    # right circle
    draw.ellipse([cx, cy - size*0.18, cx + size*0.5, cy + size*0.18], fill=fill)
    # bottom triangle (polygon)
    points = [
        (cx - size*0.5, cy + size*0.06),
        (cx + size*0.5, cy + size*0.06),
        (cx, cy + size*0.52),
    ]
    draw.polygon(points, fill=fill)

def draw_pulse_line(draw, x_start, y_base, width, amplitude, fill, line_width):
    """Draw a heartbeat/ECG pulse line."""
    pts = []
    seg = width / 10
    # flat – flat – up – peak – down – valley – up – flat – flat
    xs = [x_start,
          x_start + seg*2,
          x_start + seg*3,
          x_start + seg*4,
          x_start + seg*5,
          x_start + seg*6,
          x_start + seg*7,
          x_start + seg*8,
          x_start + seg*10]
    ys = [y_base,
          y_base,
          y_base - amplitude*0.3,
          y_base - amplitude,
          y_base + amplitude*0.4,
          y_base + amplitude*0.15,
          y_base - amplitude*0.1,
          y_base,
          y_base]
    for i in range(len(xs)-1):
        draw.line([xs[i], ys[i], xs[i+1], ys[i+1]], fill=fill, width=line_width)

def make_main_icon(size=1024):
    img = Image.new('RGB', (size, size), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Background gradient simulation: lighter in center via concentric rects
    for i in range(12):
        alpha = int(20 - i*1.5)
        r = int(size * 0.5 - i * size * 0.038)
        if r < 0: break
        c = tuple(min(255, v + alpha) for v in BG_DARK)
        draw.ellipse([size//2 - r, size//2 - r, size//2 + r, size//2 + r], fill=c)

    # Purple glow circle behind icon content
    glow_r = int(size * 0.38)
    cx, cy = size//2, size//2
    # soft glow layers
    for i in range(8):
        g_alpha = 12 - i
        g_r = glow_r + i * int(size * 0.012)
        gc = (
            min(255, PURPLE[0] + g_alpha*2),
            min(255, PURPLE[1] + g_alpha*2),
            min(255, PURPLE[2] + g_alpha*2),
        )
        draw.ellipse([cx - g_r, cy - g_r, cx + g_r, cy + g_r], fill=gc)

    # Solid inner circle
    draw.ellipse([cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r], fill=PURPLE)

    # Heart (white, slightly above center)
    heart_cy = cy - int(size * 0.04)
    heart_size = int(size * 0.40)
    draw_heart(draw, cx, heart_cy, heart_size, WHITE)

    # Pulse line across heart (green, over white heart)
    pw = int(size * 0.50)
    py = heart_cy + int(size * 0.03)
    amp = int(size * 0.085)
    lw = max(3, size // 90)
    draw_pulse_line(draw, cx - pw//2, py, pw, amp, GREEN, lw)

    return img

def make_fg_icon(size=512):
    """Foreground for adaptive icon — transparent background, centered art."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size//2, size//2

    # White heart
    heart_cy = cy - int(size * 0.04)
    heart_size = int(size * 0.54)
    draw_heart(draw, cx, heart_cy, heart_size, WHITE)

    # Pulse line (green)
    pw = int(size * 0.60)
    py = heart_cy + int(size * 0.03)
    amp = int(size * 0.10)
    lw = max(3, size // 70)
    draw_pulse_line(draw, cx - pw//2, py, pw, amp, GREEN, lw)

    return img

def make_bg_icon(size=512):
    img = Image.new('RGB', (size, size), PURPLE)
    # subtle radial highlight
    draw = ImageDraw.Draw(img)
    for i in range(6):
        r = size//2 - i*size//30
        c = tuple(min(255, v + 12 - i*2) for v in PURPLE)
        draw.ellipse([size//2 - r, size//2 - r, size//2 + r, size//2 + r], fill=c)
    return img

def make_mono_icon(size=512):
    img = Image.new('RGB', (size, size), WHITE)
    draw = ImageDraw.Draw(img)
    cx, cy = size//2, size//2
    heart_cy = cy - int(size * 0.04)
    draw_heart(draw, cx, heart_cy, int(size * 0.54), (40, 40, 80))
    lw = max(3, size // 70)
    pw = int(size * 0.60)
    py = heart_cy + int(size * 0.03)
    amp = int(size * 0.10)
    draw_pulse_line(draw, cx - pw//2, py, pw, amp, WHITE, lw)
    return img

if __name__ == '__main__':
    print('Generating icon.png (1024x1024)...')
    make_main_icon(1024).save(os.path.join(ASSETS, 'icon.png'))

    print('Generating splash-icon.png (1024x1024)...')
    make_main_icon(1024).save(os.path.join(ASSETS, 'splash-icon.png'))

    print('Generating android-icon-foreground.png (512x512)...')
    make_fg_icon(512).save(os.path.join(ASSETS, 'android-icon-foreground.png'))

    print('Generating android-icon-background.png (512x512)...')
    make_bg_icon(512).save(os.path.join(ASSETS, 'android-icon-background.png'))

    print('Generating android-icon-monochrome.png (512x512)...')
    make_mono_icon(512).save(os.path.join(ASSETS, 'android-icon-monochrome.png'))

    print('Done! All icons saved to assets/')
