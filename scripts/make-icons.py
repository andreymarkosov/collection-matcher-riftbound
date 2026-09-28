"""Draws the extension icon (original artwork: a card under a lens with an owned-count dot) at all sizes."""
from PIL import Image, ImageDraw

S = 1024
NAVY, GOLD, TEAL, GREEN, WHITE = (18, 28, 44), (214, 172, 84), (64, 156, 196), (38, 158, 92), (245, 245, 245)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([40, 40, S - 40, S - 40], radius=220, fill=NAVY)

# Two stacked cards.
card = Image.new("RGBA", (S, S), (0, 0, 0, 0))
cd = ImageDraw.Draw(card)
cd.rounded_rectangle([300, 200, 640, 680], radius=40, outline=TEAL, width=34)
card = card.rotate(10, resample=Image.BICUBIC, center=(470, 440))
img.alpha_composite(card)
card2 = Image.new("RGBA", (S, S), (0, 0, 0, 0))
cd2 = ImageDraw.Draw(card2)
cd2.rounded_rectangle([250, 230, 590, 710], radius=40, fill=NAVY, outline=GOLD, width=38)
cd2.line([320, 560, 520, 560], fill=GOLD, width=26)
cd2.line([320, 620, 460, 620], fill=GOLD, width=26)
card2 = card2.rotate(-6, resample=Image.BICUBIC, center=(420, 470))
img.alpha_composite(card2)

# Lens.
d = ImageDraw.Draw(img)
cx, cy, r = 610, 560, 190
d.line([cx + 120, cy + 120, 880, 820], fill=WHITE, width=78)
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(18, 28, 44, 235), outline=WHITE, width=56)

# Owned check inside the lens.
d.line([cx - 85, cy + 5, cx - 20, cy + 70], fill=GREEN, width=52)
d.line([cx - 20, cy + 70, cx + 95, cy - 60], fill=GREEN, width=52)

for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(f"public/icons/icon-{size}.png")
img.resize((440, 440), Image.LANCZOS).save("store/icon-440.png")
print("icons written")
