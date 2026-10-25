"""冰封实验室 hall props (world 2, layer 5): the world 2 base kit (tech_props.py) with a cyan accent, and the cold lab's
own pieces in big flat colour blocks: an insulated pod (a white drum and dome with an orange band, warm portholes,
a charcoal door with a cyan strip), a heater capsule (amber glowing glass in a yellow frame, front +Z), a heater
fan (turns on the capsule's cap) and a frost pipe elbow. The ice, the frozen waterfall, the floor and the halos
are built by tools/underground/cryoHall.ts. Shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_cryo.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import finish, model, box, lathe, prism, circle
from tech_props import tech_start, tech_services, bevel_box

ACCENT = ('1488ac', '1ca0c8')  # deep cyan
TILES = [
    ('e07a1e', [(3, 3, 26, 3, 'ee8c30'), (3, 26, 26, 3, 'c46612')]),          # 20 orange band
    ('c45a0c', [(6, 4, 20, 24, 'd86c14'), (12, 4, 8, 24, 'e07c1c')]),         # 21 glow amber glass (deep)
    ('b8c8d8', [(3, 4, 26, 3, 'cad6e2'), (3, 22, 26, 3, 'a4b6c8')]),          # 22 frosted pipe
    ('1e2a36', [(4, 5, 24, 3, '283644')]),                                    # 23 dark blue panel
]
tech_start('Cryo', 'cryo', ACCENT, TILES, glowing={21})
tech_services()

# INSULATED POD (front +Z), 4.4 m across and 4.4 m tall: a charcoal plinth, a white drum with an orange band, a
# white dome, three warm portholes and a charcoal door with a cyan strip at the front, an aerial on top.
model('Cryo_Pod')
lathe('Plinth', [(0, 2.35), (.3, 2.35)], 12, 0)
lathe('Drum', [(.3, 2.2), (2.5, 2.2)], 12, 1, cap_bottom=False, cap_top=False)
lathe('Band', [(1.55, 2.24), (1.95, 2.24)], 12, 20, cap_top=False, cap_bottom=False)
lathe('Dome', [(2.5, 2.2), (3.25, 2.0), (3.85, 1.5), (4.2, .8), (4.35, 0)], 12, 6, cap_bottom=False)
lathe('DomeRim', [(2.45, 2.28), (2.6, 2.28)], 12, 11)
for a in (-.8, .8, math.pi):
    c, t, n = (math.sin(a) * 2.2, math.cos(a) * 2.2), (math.cos(a), -math.sin(a)), (math.sin(a), math.cos(a))
    prism('Porthole', [(c[0] + u * .38 * t[0] + v * n[0], c[1] + u * .38 * t[1] + v * n[1]) for u, v in ((-1, -.05), (1, -.05), (1, .08), (-1, .08))], 1.95, 2.45, 9)
bevel_box('DoorFrame', (0, 1.2, 2.18), (1.6, 2.4, .5), 0, .14)
box('Door', (0, 1.15, 2.45), (1.2, 2.0, .06), 23)
box('DoorStrip', (0, 2.25, 2.49), (1.0, .1, .04), 7)
box('DoorWindow', (0, 1.6, 2.49), (.6, .4, .04), 9)
box('Aerial', (.8, 4.6, -.4), (.08, 1.2, .08), 0)
box('AerialTip', (.8, 5.25, -.4), (.16, .12, .16), 7)

# HEATER CAPSULE (front +Z), 2.9 m: a yellow base with a hazard band, a tall amber glowing glass cylinder held by
# four white posts, a white cap with a dark grille (the fan turns above it at y = 2.84).
model('Heater_Capsule')
bevel_box('Base', (0, .3, 0), (1.2, .6, 1.2), 11, .16)
box('BaseBand', (0, .3, .61), (1.0, .18, .04), 5)
lathe('Glass', [(.6, .42), (2.3, .42)], 8, 21, cap_bottom=False, cap_top=False)
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    box('Post', (math.cos(a) * .48, 1.45, math.sin(a) * .48), (.12, 1.8, .12), 1)
lathe('Cap', [(2.3, .58), (2.62, .58), (2.75, .42)], 8, 1, cap_bottom=True)
lathe('Grille', [(2.75, .4), (2.8, .4)], 8, 0)
model('Heater_Fan')
prism('Hub', circle(.1, 6), .0, .08, 0)
for k in range(4):
    a = k * math.pi / 2
    c, s = math.cos(a), math.sin(a)
    prism('Blade', [(px * c - pz * s, px * s + pz * c) for px, pz in ((.08, -.07), (.36, -.1), (.36, .08), (.08, .05))], .02, .06, 2)

# FROST PIPE ELBOW (runs +Z from the origin, then up): a frosted pipe with a yellow collar and a cyan gauge light.
model('Frost_Pipe')
box('Run', (0, .9, .9), (.5, .5, 1.8), 22)
box('Riser', (0, 2.3, 1.8), (.5, 3.3, .5), 22)
box('Collar', (0, .9, .25), (.62, .62, .14), 11)
box('Collar', (0, 3.4, 1.8), (.62, .14, .62), 11)
box('Gauge', (0, 1.5, 2.06), (.24, .24, .04), 7)

finish(__file__)
