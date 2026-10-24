"""熔岩矿洞 hall props: the two service stalls (only the sale stall is placed on layers without a shop), the
lantern post, the name board frame and the pit post, on the shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_volcanic.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike, stall, lantern_post, name_board, pit_post

TILES = [
    ("3a2e2c", [(4, 6, 24, 3, '4a3c38'), (6, 24, 18, 2, '2e2422')]),
    ("8a5a3a", [(4, 5, 24, 3, '9a6a48'), (6, 24, 19, 2, '7a4c2e')]),
    ("5a4f4c", [(4, 5, 10, 3, '6a5e5a'), (18, 20, 10, 6, '4c4240')]),
    ("3a3030", [(3, 4, 9, 3, '4a3e3c'), (17, 20, 9, 4, '2e2626')]),
    ("5a2a24", [(2, 6, 28, 3, '6a3a30'), (2, 20, 28, 3, '4a201c')]),
    ("2e2a30", [(2, 6, 28, 3, '3e3a40'), (2, 20, 28, 3, '242026')]),
    ("d8c8b8", [(4, 4, 3, 24, 'c8b8a8')]),
    ("ff8a3a", [(8, 8, 16, 16, 'ffd08a')]),
    ("ffc04a", [(8, 8, 16, 16, 'fff0b0')]),
    ("ffd38a", [(6, 6, 20, 20, 'fff0c8')]),
    ("2a2a30", [(4, 5, 22, 3, '3a3a42')]),
    ("f2be56", [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),
    ("e05a3a", [(4, 4, 8, 20, 'ff9a6a'), (18, 8, 6, 16, 'b03a24')]),
    ("7a5a42", [(2, 10, 28, 3, '8a6a50'), (2, 20, 28, 3, '6a4a34')]),
    ("4a3632", [(4, 5, 24, 3, '5a4440')]),
    ("1a1212", []),
]
start('Volcanic', 'volcanic', TILES, glowing={7, 8, 9})

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
