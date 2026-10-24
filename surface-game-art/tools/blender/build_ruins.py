"""地下遗迹 hall props: the two service stalls (only the sale stall is placed on layers without a shop), the
lantern post, the name board frame and the pit post, on the shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_ruins.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike, stall, lantern_post, name_board, pit_post

TILES = [
    ("6a5236", [(4, 6, 24, 3, '7a6044'), (6, 24, 18, 2, '5a442c')]),
    ("c09a6a", [(4, 5, 24, 3, 'd0aa7a'), (6, 24, 19, 2, 'ac8858')]),
    ("b49c76", [(4, 5, 10, 3, 'c2aa84'), (18, 20, 10, 6, 'a08a66')]),
    ("5a7a3a", [(3, 4, 9, 3, '6a8a48'), (17, 20, 9, 4, '4a6a2e')]),
    ("3a8a6a", [(2, 6, 28, 3, '4a9a7a'), (2, 20, 28, 3, '2e7a5c')]),
    ("b44a3a", [(2, 6, 28, 3, 'c45a48'), (2, 20, 28, 3, '9a3a2e')]),
    ("e8dcc0", [(4, 4, 3, 24, 'd8ccb0')]),
    ("7ff5c4", [(8, 8, 16, 16, 'd0ffe8')]),
    ("ffb45c", [(8, 8, 16, 16, 'ffe0a8')]),
    ("ffd38a", [(6, 6, 20, 20, 'fff0c8')]),
    ("3a3a42", [(4, 5, 22, 3, '4a4a54')]),
    ("f2be56", [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),
    ("58d6a8", [(4, 4, 8, 20, '9af0d0'), (18, 8, 6, 16, '3db388')]),
    ("a07a52", [(2, 10, 28, 3, 'b48c62'), (2, 20, 28, 3, '8d6a46')]),
    ("8a6a48", [(4, 5, 24, 3, '9a7a58')]),
    ("3c3122", []),
]
start('Ruins', 'ruins', TILES, glowing={7, 8, 9})

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
