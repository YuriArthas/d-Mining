"""冰封矿洞 hall props: glowing ice formations, the sale stall under a snow-capped plank roof with icicles, a
campfire with log seats, an igloo and an ore sled, snowy rim stones, frost rocks, and the shared lantern post,
name board frame and pit post (footprints in cave_props.py).
Run: blender -b --python tools/blender/build_frozen.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike, stall, lantern_post, name_board, pit_post

TILES = [
    ("4a5a6e", [(4, 6, 24, 3, '566a80'), (6, 24, 18, 2, '3e4c5e')]),    # 0 dark frame
    ("a0806a", [(4, 5, 24, 3, 'b0907a'), (6, 24, 19, 2, '8e705a')]),    # 1 counter / planks
    ("8aa4bc", [(4, 5, 10, 3, '98b2ca'), (18, 20, 10, 6, '7c96ae')]),   # 2 stone
    ("e8f2fa", [(3, 4, 9, 3, 'ffffff'), (17, 20, 9, 4, 'd4e4f0')]),     # 3 snow
    ("c84a3a", [(2, 6, 28, 3, 'd85a48'), (2, 20, 28, 3, 'b03a2e')]),    # 4 red cloth
    ("3a6ab4", [(2, 6, 28, 3, '4a7ac4'), (2, 20, 28, 3, '2e5a9a')]),    # 5 blue cloth
    ("f4faff", [(4, 4, 3, 24, 'e4eef8')]),                              # 6 pale
    ("a0f0ff", [(8, 8, 16, 16, 'e0fcff')]),                             # 7 glow ice
    ("b4eeff", [(8, 8, 16, 16, 'e8fbff')]),                             # 8 glow frost
    ("ffc48a", [(6, 6, 20, 20, 'fff0d8')]),                             # 9 glow warm
    ("34404e", [(4, 5, 22, 3, '44505e')]),                              # 10 iron
    ("f2be56", [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),    # 11 gold
    ("8ad8f0", [(4, 4, 8, 20, 'c8f4ff'), (18, 8, 6, 16, '6ab8d8')]),    # 12 ore (ice blue)
    ("a07a52", [(2, 10, 28, 3, 'b48c62'), (2, 20, 28, 3, '8d6a46')]),   # 13 rope
    ("5a7a9a", [(4, 5, 24, 3, '6a8aaa')]),                              # 14 board
    ("30445c", []),                                                     # 15 shadow
    ("94d2ec", [(4, 3, 6, 24, 'c4ecfa'), (20, 6, 4, 20, '74bcdc')]),    # 16 clear ice facet
    ("eef4fa", [(0, 15, 32, 2, 'c8d8e6'), (15, 0, 2, 15, 'c8d8e6'), (6, 17, 2, 15, 'c8d8e6'), (24, 17, 2, 15, 'c8d8e6')]),  # 17 snow blocks
    ("ff8a3a", [(8, 6, 16, 20, 'ffc860')]),                             # 18 glow flame
    ("6a4a34", [(2, 8, 28, 3, '7a5a42'), (2, 20, 28, 2, '5a3e2a')]),    # 19 bark
    ("36aadc", [(6, 4, 8, 24, '78d4f4'), (20, 8, 5, 18, '58c2ea')]),    # 20 glow deep ice
]
start('Frozen', 'frozen', TILES, glowing={7, 8, 9, 18, 20})

def ice_faces(sides, glow_every=2):
    """Per-face tiles for a spike: clear ice cap, sides alternating glowing and clear, clear tips with a glint."""
    return [16] + [20 if k % glow_every == 0 else 16 for k in range(sides)] + [8 if k == 0 else 16 for k in range(sides)]

# ICE FORMATION, unit height (placed scaled by its height): a snowy rock foot and a fan of chunky leaning
# hexagonal ice prisms, faces alternating glowing deep ice and clear ice.
model('Ice_Spire')
lathe('Foot', [(0, .3), (.06, .28), (.12, .17)], 7, 2)
lathe('FootSnow', [(.1, .22), (.14, .16), (.165, .05)], 7, 3, cap_bottom=False)
for i, (x, z, h, r, lean) in enumerate([(0, 0, 1.0, .12, (0, 0)), (.16, .05, .62, .085, (.24, .06)), (-.15, .1, .56, .08, (-.26, .12)),
                                        (.03, -.17, .5, .075, (.04, -.3)), (-.07, .18, .42, .065, (-.1, .32)), (.16, -.12, .36, .06, (.32, -.22))]):
    spike('Ice', x, z, h, r, 6, ice_faces(6), lean=lean, y=.06, tip=.74, spin=i * .7)
# A small cluster (about 1.2 m) for the wall feet.
model('Ice_Cluster')
lathe('Foot', [(0, .5), (.18, .42), (.3, .15)], 6, 2)
for i, (x, z, h, r, lean) in enumerate([(0, 0, 1.25, .17, (0, 0)), (.3, .12, .8, .12, (.35, .1)), (-.26, .16, .7, .11, (-.4, .15)), (.04, -.28, .6, .1, (.05, -.4))]):
    spike('Ice', x, z, h, r, 6, ice_faces(6), lean=lean, y=.12, tip=.72, spin=i)
# A frost rock: a faceted boulder with a snow cap.
model('Frost_Rock')
lathe('Rock', [(0, .55), (.3, .62), (.58, .45), (.7, .2)], 7, 2, spin=.3)
lathe('RockSnow', [(.5, .5), (.66, .34), (.8, .06)], 7, 3, spin=.3, cap_bottom=False)

# SALE STALL under a plank roof with a thick snow cap and icicles along the front edge.
def roof():
    prism('Roof', stepped(5.8, 3.6, .3), 3.6, 3.82, 1)
    prism('RoofSnow', stepped(5.7, 3.5, .5), 3.82, 4.06, 3)
    prism('RoofSnowTop', stepped(4.4, 2.5, .7), 4.06, 4.3, 3)
    for x, h in ((-2.5, .55), (-1.9, .35), (-1.1, .6), (-.4, .3), (.7, .5), (1.3, .7), (2.0, .4), (2.6, .5)):
        lathe('Icicle', [(3.6 - h, 0), (3.6, .09)], 5, 16, cx=x, cz=1.66, cap_bottom=False)
stall('Stall_Sell', 'coin', roof)
stall('Stall_Shop', 'pick', roof)
lantern_post()

# NAME BOARD FRAME: timber uprights with snow caps topped by glowing ice.
def upright(x):
    box('UprightFoot', (x, .3, 0), (.72, .6, .72), 2)
    box('Upright', (x, 3.9, 0), (.46, 7.4, .46), 0)
    lathe('UprightSnow', [(7.5, .45), (7.7, .48), (7.95, .3), (8.05, .1)], 8, 3, cx=x)
    spike('UprightIce', x, 0, .9, .16, 6, ice_faces(6), y=7.95, tip=.7)
name_board(upright)
pit_post(lambda: spike('PostIce', 0, 0, .7, .17, 6, ice_faces(6), y=1.1, tip=.66))

# SNOWY RIM STONE for the frozen pond.
model('Pool_Stone')
prism('Stone', [(-.55, -.32), (.5, -.36), (.62, .1), (.4, .38), (-.42, .34), (-.62, .02)], 0, .42, 2)
prism('StoneSnow', [(-.47, -.24), (.42, -.28), (.52, .08), (.32, .28), (-.36, .26), (-.52, .0)], .42, .52, 3)

# CAMPFIRE: a ring of stones, three crossed logs, a chunky flame; two log seats either side (x = +-1.7).
model('Campfire')
for i in range(9):
    a = 2 * math.pi * i / 9
    lathe('RingStone', [(0, .17), (.14, .16), (.25, .06)], 6, 2, cx=math.cos(a) * .78, cz=math.sin(a) * .78, spin=i)
def log(name, cx, cz, length, radius, angle, y):
    c, s = math.cos(angle), math.sin(angle)
    ring = circle(radius, 6, 0, y, .26)
    # a hexagonal log lying along `angle` in XZ
    v = [(cx + c * (-length / 2) - s * px, py, cz + s * (-length / 2) + c * px) for px, py in ring] + \
        [(cx + c * (length / 2) - s * px, py, cz + s * (length / 2) + c * px) for px, py in ring]
    f = [tuple(reversed(range(6))), tuple(range(6, 12))] + [(k, (k + 1) % 6, (k + 1) % 6 + 6, k + 6) for k in range(6)]
    return mesh(name, v, f, [6, 6] + [19] * 6)
for k in range(3): log('Log', 0, 0, 1.2, .1, k * math.pi / 3, .16)
lathe('Flame', [(.12, .4), (.42, .3), (.78, .14), (1.12, 0)], 5, 18)
lathe('FlameTongue', [(.3, .14), (.6, .08), (.9, 0)], 4, 9, cx=.24, cz=.1, spin=.4)
lathe('FlameTongue', [(.25, .12), (.5, .07), (.78, 0)], 4, 9, cx=-.2, cz=-.12, spin=1.1)
lathe('Embers', [(.06, .34), (.12, .3)], 7, 18)
for side in (-1, 1): log('Seat', side * 1.7, 0, 1.5, .2, math.pi / 2, .2)

# IGLOO, entrance toward +Z: a dome of snow blocks, an arched tunnel and a warm glowing doorway.
model('Igloo')
lathe('Dome', [(0, 2.8), (.7, 2.74), (1.4, 2.42), (2.0, 1.92), (2.45, 1.2), (2.7, .45), (2.78, 0)], 14, 17, cap_bottom=False)
arch = [(-.95, 0), (.95, 0), (.95, 1.0), (.68, 1.5), (0, 1.75), (-.68, 1.5), (-.95, 1.0)]
prism('Tunnel', arch, 1.9, 3.5, 17, axis='z')
door = [(-.55, .02), (.55, .02), (.55, .85), (.38, 1.15), (0, 1.3), (-.38, 1.15), (-.55, .85)]
prism('Doorway', door, 3.5, 3.53, 9, axis='z')
for x, z in ((1.9, 1.6), (-2.1, 1.4)):
    box('IceBlock', (x, .3, z), (.62, .6, .62), 16)
box('IceBlockTop', (1.9, .82, 1.6), (.5, .44, .5), 16)
# ORE SLED: iron runners, a plank deck and a crate of ice ore.
model('Ore_Sled')
for side in (-1, 1):
    box('Runner', (side * .48, .07, 0), (.1, .14, 2.3), 10)
    box('RunnerTip', (side * .48, .22, 1.2), (.1, .3, .12), 10)
box('Deck', (0, .22, -.05), (1.15, .12, 2.0), 1)
box('Crate', (0, .58, -.35), (.9, .6, .9), 1); box('CrateBand', (0, .58, -.35), (.94, .14, .94), 0)
for k in range(4): box('Ore', (-.24 + k * .16, .96, -.35 + (k % 2) * .12), (.22, .2, .22), 12)
box('Rope', (0, .32, .75), (1.0, .08, .08), 13)
finish(__file__)
