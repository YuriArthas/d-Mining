"""水晶洞穴 hall props: the two service stalls (only the sale stall is placed on layers without a shop), the
lantern post, the name board frame and the pit post, on the shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_crystal.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike, stall, lantern_post, name_board, pit_post

TILES = [
    ("3c4664", [(4, 6, 24, 3, '48537a'), (6, 24, 18, 2, '323a54')]),
    ("7a8ab8", [(4, 5, 24, 3, '8a9ac8'), (6, 24, 19, 2, '6a7aa8')]),
    ("5b6a90", [(4, 5, 10, 3, '68789e'), (18, 20, 10, 6, '4f5c80')]),
    ("4a5a8a", [(3, 4, 9, 3, '56689a'), (17, 20, 9, 4, '3e4c78')]),
    ("3fd4f0", [(4, 4, 8, 20, 'a0f4ff'), (18, 8, 6, 16, '2ab0d0')]),
    ("e45cc4", [(4, 4, 8, 20, 'ffb0ec'), (18, 8, 6, 16, 'c040a4')]),
    ("dce8ff", [(4, 4, 3, 24, 'c8d8f4')]),
    ("8ff4ff", [(8, 8, 16, 16, 'd8fcff')]),
    ("ff9ae6", [(8, 8, 16, 16, 'ffd8f4')]),
    ("ffd38a", [(6, 6, 20, 20, 'fff0c8')]),
    ("283447", [(4, 5, 22, 3, '344257')]),
    ("f2be56", [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),
    ("58d6e8", [(4, 4, 8, 20, '9af0f6'), (18, 8, 6, 16, '3db3c7')]),
    ("8a8aa8", [(2, 10, 28, 3, '9a9ab8'), (2, 20, 28, 3, '7a7a98')]),
    ("4a5688", [(4, 5, 24, 3, '5a66a0')]),
    ("22283f", []),
]
start('Crystal', 'crystal', TILES, glowing={7, 8, 9})

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
