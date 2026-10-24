"""老矿井 hall props: the two service stalls (only the sale stall is placed on layers without a shop), the
lantern post, the name board frame and the pit post, on the shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_old_mine.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike, stall, lantern_post, name_board, pit_post

TILES = [
    ("5a4234", [(4, 6, 24, 3, '674c3b'), (6, 24, 18, 2, '4f392c')]),
    ("c08a52", [(4, 5, 24, 3, 'cf9a61'), (6, 24, 19, 2, 'ad7a45')]),
    ("7d6a58", [(4, 5, 10, 3, '8a7764'), (18, 20, 10, 6, '6e5c4c')]),
    ("8a6f50", [(3, 4, 9, 3, '9a7f60'), (17, 20, 9, 4, '7a6044')]),
    ("a8683c", [(2, 6, 28, 3, 'b8784a'), (2, 20, 28, 3, '94592f')]),
    ("7c4a2c", [(2, 6, 28, 3, '8c5a3a'), (2, 20, 28, 3, '6a3e24')]),
    ("e6d2b0", [(4, 4, 3, 24, 'd6c2a0')]),
    ("ffc878", [(8, 8, 16, 16, 'fff0c8')]),
    ("ff9a4c", [(8, 8, 16, 16, 'ffd0a0')]),
    ("ffd38a", [(6, 6, 20, 20, 'fff0c8')]),
    ("3a3a42", [(4, 5, 22, 3, '4a4a54')]),
    ("f2be56", [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),
    ("d08a4a", [(4, 4, 8, 20, 'f0aa66'), (18, 8, 6, 16, 'b07038')]),
    ("a07a52", [(2, 10, 28, 3, 'b48c62'), (2, 20, 28, 3, '8d6a46')]),
    ("8a6a48", [(4, 5, 24, 3, '9a7a58')]),
    ("3a2a20", []),
]
start('OldMine', 'old-mine', TILES, glowing={7, 8, 9})

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
