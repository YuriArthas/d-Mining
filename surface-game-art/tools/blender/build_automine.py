"""自动化矿道 hall props (world 2, layer 1): a mining base built into the cave. Shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_automine.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle, spike, stall, lantern_post, name_board, pit_post

# Plastic-toy tech: light panel grey, gunmetal, navy, cyan and orange glow, hazard stripes.
TILES = [
    ('3a414c', [(4, 6, 24, 2, '4a525e')]),                                   # 0 gunmetal frame
    ('c9ced6', [(2, 2, 28, 2, 'dde1e7'), (2, 28, 28, 2, 'a9b0ba')]),          # 1 light panel
    ('8d95a1', [(4, 5, 10, 3, '9aa2ad'), (18, 20, 10, 6, '7f8794')]),         # 2 mid grey
    ('5a6270', [(3, 4, 9, 3, '666e7c')]),                                     # 3 deck grating
    ('24324a', [(2, 14, 28, 2, '31415c')]),                                   # 4 navy roof
    ('f2c230', [(0, 0, 8, 32, '2a2a2e'), (16, 0, 8, 32, '2a2a2e')]),          # 5 hazard stripes
    ('eef1f5', []),                                                           # 6 white
    ('5ee8ff', [(8, 8, 16, 16, 'c8faff')]),                                   # 7 glow cyan
    ('ff9a2e', [(8, 8, 16, 16, 'ffd8a0')]),                                   # 8 glow orange
    ('ffe4b0', [(6, 6, 20, 20, 'fff6e0')]),                                   # 9 glow warm white
    ('2a2e36', [(4, 5, 22, 3, '363b45')]),                                    # 10 iron
    ('f2be56', [(3, 3, 26, 4, 'ffd27a'), (5, 26, 24, 3, 'e2ad49')]),          # 11 gold
    ('6a8cff', [(4, 4, 8, 20, '9ab0ff'), (18, 8, 6, 16, '4a6ad8')]),          # 12 cobalt ore
    ('4a4f58', [(2, 10, 28, 3, '5a606a')]),                                   # 13 cable
    ('1c2a3a', [(4, 5, 24, 3, '263648')]),                                    # 14 screen board
    ('16181e', []),                                                           # 15 shadow
]
start('Automine', 'automine', TILES, glowing={7, 8, 9})

def roof():
    prism('Roof', stepped(5.8, 3.6, .3), 3.6, 3.85, 4)
    box('RoofLight', (0, 3.56, 1.5), (5.0, .1, .14), 7)
stall('Stall_Sell', 'coin', roof)
stall('Stall_Shop', 'pick', roof)
lantern_post()
def upright(x):
    box('UprightFoot', (x, .3, 0), (.7, .6, .7), 2)
    box('Upright', (x, 3.9, 0), (.44, 7.4, .44), 0)
    box('UprightCap', (x, 7.75, 0), (.8, .3, .8), 7)
name_board(upright)
pit_post(lambda: box('PostLight', (0, 1.25, 0), (.36, .3, .36), 8))
finish(__file__)
