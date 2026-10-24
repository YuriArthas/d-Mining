"""冰封矿洞 hall props: the two service stalls (only the sale stall is placed on layers without a shop), the
lantern post, the name board frame and the pit post, on the shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_frozen.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike, stall, lantern_post, name_board, pit_post

TILES = [
    ("4a5a6e", [(4, 6, 24, 3, '566a80'), (6, 24, 18, 2, '3e4c5e')]),
    ("a0806a", [(4, 5, 24, 3, 'b0907a'), (6, 24, 19, 2, '8e705a')]),
    ("8aa4bc", [(4, 5, 10, 3, '98b2ca'), (18, 20, 10, 6, '7c96ae')]),
    ("e8f2fa", [(3, 4, 9, 3, 'ffffff'), (17, 20, 9, 4, 'd4e4f0')]),
    ("c84a3a", [(2, 6, 28, 3, 'd85a48'), (2, 20, 28, 3, 'b03a2e')]),
    ("3a6ab4", [(2, 6, 28, 3, '4a7ac4'), (2, 20, 28, 3, '2e5a9a')]),
    ("f4faff", [(4, 4, 3, 24, 'e4eef8')]),
    ("a0f0ff", [(8, 8, 16, 16, 'e0fcff')]),
    ("d8f8ff", [(8, 8, 16, 16, 'ffffff')]),
    ("ffc48a", [(6, 6, 20, 20, 'fff0d8')]),
    ("34404e", [(4, 5, 22, 3, '44505e')]),
    ("f2be56", [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),
    ("8ad8f0", [(4, 4, 8, 20, 'c8f4ff'), (18, 8, 6, 16, '6ab8d8')]),
    ("a07a52", [(2, 10, 28, 3, 'b48c62'), (2, 20, 28, 3, '8d6a46')]),
    ("5a7a9a", [(4, 5, 24, 3, '6a8aaa')]),
    ("30445c", []),
]
start('Frozen', 'frozen', TILES, glowing={7, 8, 9})

def roof():
    prism('Roof', stepped(5.8, 3.6, .3), 3.6, 3.85, 4)
    box('RoofTrim', (0, 3.98, 0), (5.2, .16, 3.0), 5)
stall('Stall_Sell', 'coin', roof)
stall('Stall_Shop', 'pick', roof)
lantern_post()
def upright(x):
    box('UprightFoot', (x, .3, 0), (.7, .6, .7), 2)
    box('Upright', (x, 3.9, 0), (.44, 7.4, .44), 0)
    box('UprightCap', (x, 7.75, 0), (.8, .3, .8), 2)
name_board(upright)
pit_post(lambda: lathe('PostGlow', [(1.1, .2), (1.35, .2), (1.6, 0)], 6, 7))
finish(__file__)
