"""地心反应堆 hall props (world 2, layer 6): the world 2 base kit in big flat colour blocks (light panel white, bright
yellow, charcoal, orange glow) round the planet's molten core. White kiosks with icon screens (an ore chunk for the
sale, crossed pickaxes for the shop) on the shared stall frame, a white lamp post, a screen name board, a yellow
bollard, the reactor facade on the north wall, the reactor ring with its turning rotor, the core clamps, cooling
towers with turning fans, a ceiling lamp and crate stacks. The core itself, the floor, the rail and the glow
halos are built by tools/underground/reactorHall.ts. Shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_reactor.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import finish, model, box, lathe, prism
from tech_props import tech_start, tech_services, tech_facade, bevel_box, ring_segments

ACCENT = ('c2460a', 'd45a12')  # deep orange
TILES = [
    ('e07a1e', [(3, 3, 26, 3, 'ee8c30'), (3, 26, 26, 3, 'c46612')]),          # 20 orange paint (spare)
]
tech_start('Reactor', 'reactor', ACCENT, TILES)
tech_services()

# REACTOR FACADE on the north wall (tech_props.tech_facade): it hides the voxel wall behind the core.
tech_facade('Reactor_Facade')

# REACTOR RING round the core (front +Z, centre at the origin): a broad white ring with a yellow outer band,
# an orange glow lip on its inner edge and four yellow clamps at the diagonals reaching in to the core.
model('Reactor_Ring')
ring_segments('Ring', 5.0, 6.2, -.6, .6, 24, 1)
ring_segments('RingBand', 6.2, 6.5, -.45, .45, 24, 11)
ring_segments('RingLip', 4.82, 5.02, -.2, .62, 24, 7)
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    c, s = math.cos(a), math.sin(a)
    rot = lambda pts: [(px * c - py * s, px * s + py * c) for px, py in pts]
    prism('ClampArm', rot([(4.2, -.55), (6.9, -.75), (6.9, .75), (4.2, .55)]), -.5, .9, 11, axis='z')
    prism('ClampJaw', rot([(3.9, -.8), (4.5, -.8), (4.5, .8), (3.9, .8)]), -.3, 1.1, 0, axis='z')
    prism('ClampLight', rot([(5.2, -.12), (6.4, -.12), (6.4, .12), (5.2, .12)]), .9, .96, 9, axis='z')
# The ROTOR turns about Z just inside the ring: eight glowing pods on a thin dark track.
model('Reactor_Rotor')
ring_segments('Track', 5.0, 5.3, .62, .74, 32, 0)
for k in range(8):
    a = 2 * math.pi * k / 8
    c, s = math.cos(a), math.sin(a)
    prism('Pod', [(5.15 * c + px * c - py * s, 5.15 * s + px * s + py * c) for px, py in ((-.3, -.4), (.3, -.4), (.3, .4), (-.3, .4))], .7, 1.0, 16, axis='z')

# COOLING TOWER (on the floor beside the facade): a white drum with yellow bands, an orange vent ring and a dark
# grille, crowned by a fan housing; the fan (Cooling_Fan) turns on top at y = 8.15.
model('Cooling_Tower')
lathe('Drum', [(0, 2.3), (.6, 2.3), (.6, 2.0), (7.4, 2.0), (7.8, 1.7)], 12, 1, tiles_by_band=[0, 1, 1, 1])
for y in (1.4, 5.6): lathe('Band', [(y, 2.04), (y + .5, 2.04)], 12, 11, cap_top=False, cap_bottom=False)
lathe('VentRing', [(3.4, 2.04), (3.8, 2.04)], 12, 7, cap_top=False, cap_bottom=False)
lathe('Housing', [(7.8, 1.8), (8.2, 1.8)], 12, 0)
for k in range(4):
    a = k * math.pi / 2
    box('Grille', (math.cos(a) * 2.02, 4.6, math.sin(a) * 2.02), (.9 if k % 2 else .06, .8, .06 if k % 2 else .9), 18)
model('Cooling_Fan')
lathe('Hub', [(0, .3), (.25, .3)], 8, 2)
for k in range(5):
    a = k * 2 * math.pi / 5
    c, s = math.cos(a), math.sin(a)
    prism('Blade', [(px * c - pz * s, px * s + pz * c) for px, pz in ((.25, -.18), (1.6, -.3), (1.6, .26), (.25, .14))], .06, .16, 2)

finish(__file__)
