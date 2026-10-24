"""第二世界 surface base props: the service kiosks (more to come). Run: blender -b --python tools/blender/build_tech_base.py"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import start, finish, model, mesh, box, lathe, prism, stepped, circle

TILES = [
    ('3a414c', []), ('c9ced6', [(2, 2, 28, 2, 'dde1e7')]), ('8d95a1', []), ('5a6270', []), ('24324a', []),
    ('f2c230', [(0, 0, 8, 32, '2a2a2e'), (16, 0, 8, 32, '2a2a2e')]), ('eef1f5', []), ('5ee8ff', [(8, 8, 16, 16, 'c8faff')]),
    ('ff9a2e', [(8, 8, 16, 16, 'ffd8a0')]), ('ffe4b0', []), ('2a2e36', []), ('f2be56', []), ('6a8cff', []), ('4a4f58', []), ('1c2a3a', []), ('16181e', []),
]
start('TechBase', 'tech-base', TILES, glowing={7, 8, 9})
for name, accent in (('Kiosk_Sell', 8), ('Kiosk_Shop', 7)):
    model(name)
    box('Base', (0, .2, 0), (6, .4, 4), 2)
    box('Body', (0, 1.6, -.6), (5.4, 2.8, 2.6), 1)
    box('Roof', (0, 3.2, 0), (6.2, .4, 4.2), 4)
    box('Strip', (0, 3.0, 2.05), (6.0, .14, .1), accent)
finish(__file__)
