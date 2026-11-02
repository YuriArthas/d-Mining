"""巨齿工厂 hall props (world 2, layer 2): the world 2 base kit (tech_props.py) with a teal accent, round a huge
half-buried ancient machine. The machine frame for the north wall (slate panels between bronze pylons), gears in
three sizes (bronze rim and teeth, dark web, teal spokes, a glowing teal ring and hub; each turns about Z) with a
teal socket ring behind, a power core (a glowing teal column in a white frame on a bronze base), the colony's white
catwalk with a yellow rail, and a yellow jib crane hanging a hazard crate. The floor, the rail, the halos and the
placement are tools/underground/gearHall.ts. Shared footprints in cave_props.py.
Run: blender -b --python tools/blender/build_gear.py
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cave_props import finish, model, box, lathe, prism, circle, solid, solid_of, passable
from tech_props import tech_start, tech_services, bevel_box, ring_segments

ACCENT = ('0c6c74', '12808a')  # deep teal
TILES = [
    ('a07a30', [(3, 3, 26, 3, 'bc9444'), (3, 26, 26, 3, '7a5a20')]),          # 20 bronze
    ('5a4420', [(4, 6, 24, 2, '6a5228')]),                                    # 21 dark bronze
    ('2a7a72', [(3, 3, 26, 3, '36948a'), (3, 26, 26, 3, '1f625c')]),          # 22 teal paint
    ('262c34', [(0, 10, 32, 2, '313844'), (15, 0, 2, 32, '313844')]),         # 23 slate panel, seams
]
tech_start('Gear', 'gear', ACCENT, TILES)
tech_services()

def rot(points, a, cx=0, cy=0):
    c, s = math.cos(a), math.sin(a)
    return [(cx + px * c - py * s, cy + px * s + py * c) for px, py in points]

# GEARS (front +Z, turning about Z through the origin): a bronze rim with chunky teeth, a recessed dark web, six
# teal spokes, a glowing teal ring on the web and a bronze hub with a glowing cap. Sizes match gearHall.ts.
def gear(name, R, teeth):
    model(name)
    n = max(24, 2 * teeth)
    ring_segments('Rim', R * .74, R * .9, -.45, .45, n, 20)
    for k in range(teeth):
        a = 2 * math.pi * k / teeth; w0, w1 = math.pi / teeth * .55, math.pi / teeth * .38
        tooth = [(math.cos(-w0) * R * .89, math.sin(-w0) * R * .89), (math.cos(-w1) * R, math.sin(-w1) * R),
                 (math.cos(w1) * R, math.sin(w1) * R), (math.cos(w0) * R * .89, math.sin(w0) * R * .89)]
        prism('Tooth', rot(tooth, a), -.4, .4, 20, axis='z')
    ring_segments('Web', R * .36, R * .74, -.25, .2, n, 21)
    ring_segments('GlowRing', R * .58, R * .64, .2, .28, n, 7)
    for k in range(6):
        prism('Spoke', rot([(R * .36, -R * .055), (R * .74, -R * .055), (R * .74, R * .055), (R * .36, R * .055)], k * math.pi / 3 + .26), .2, .36, 22, axis='z')
    prism('Hub', circle(R * .36, 12), -.55, .55, 20, axis='z')
    prism('HubRing', circle(R * .26, 12), .55, .62, 21, axis='z')
    prism('HubCap', circle(R * .18, 10), .62, .72, 7, axis='z')
    solid_of(hull=True)  # the whole wheel: the same shape however it turns (high in the gear hall, on the ground by the bases' stations)
gear('Gear_Large', 5.0, 20)
gear('Gear_Medium', 4.2, 16)
gear('Gear_Small', 2.4, 10)
# SOCKET: the teal ring set in the frame behind a gear, unit size (scaled by the gear's radius), with bolts.
model('Gear_Socket')
ring_segments('Socket', 1.0, 1.16, -.12, .12, 32, 22)
for k in range(8):
    a = 2 * math.pi * k / 8 + math.pi / 8
    box('Bolt', (math.cos(a) * 1.08, math.sin(a) * 1.08, .13), (.07, .07, .04), 20)
passable('a ring set in the frame wall behind its gear')

# MACHINE FRAME on the north wall (front +Z, its back at local z = -.3), 25.6 m wide and 20 m tall: slate panels
# between bronze pylons with teal bands and glow strips, a bronze lintel, teal rails across and a hazard plinth.
model('Machine_Frame')
box('Wall', (0, 10, 0), (23.4, 20, .6), 23)
for side in (-1, 1):
    x = side * 12.0
    box('Pylon', (x, 10, .4), (1.6, 20, 1.4), 20)
    for y in (3.0, 10.0, 17.0): box('PylonBand', (x, y, .4), (1.66, .7, 1.46), 22)
    box('PylonStrip', (x - side * .82, 10, .9), (.08, 16, .12), 7)
    bevel_box('PylonFoot', (x, .6, .7), (2.2, 1.2, 2.0), 0, .3)
box('Lintel', (0, 19.4, .5), (23.4, 1.2, 1.2), 20)
box('LintelBand', (0, 18.75, 1.12), (23.4, .14, .06), 7)
for y in (2.4, 18.0): box('Rail', (0, y, .45), (22.6, .5, .3), 22)
box('Plinth', (0, .55, .55), (22.2, 1.1, .9), 5)
box('PlinthTop', (0, 1.15, .55), (22.4, .12, 1.0), 0)
for x in (-8, -4, 4, 8):
    box('Vent', (x, 3.4, .62), (1.6, 1.0, .06), 18)
    box('VentLight', (x, 4.05, .63), (1.4, .1, .05), 7)
solid((0, 10, -.1), (24.0, 20, .8)); solid((0, .6, .55), (22.2, 1.2, .9))  # the wall and the hazard plinth
for x in (-12.0, 12.0): solid((x, 10, .4), (1.6, 20, 1.4))

# POWER CORE (on the floor, 15 m): a bronze base, a white four-post frame with yellow bands, a glowing teal column in
# four segments between bronze collars, a white cap and a bronze dome.
model('Power_Core')
bevel_box('Base', (0, .6, 0), (2.6, 1.2, 2.6), 20, .35)
bevel_box('BaseBand', (0, 1.1, 0), (2.66, .16, 2.66), 22, .35)
for x in (-.95, .95):
    for z in (-.95, .95):
        box('Post', (x, 7.6, z), (.3, 12.8, .3), 1)
        for y in (2.0, 13.2): box('PostBand', (x, y, z), (.34, .5, .34), 11)
for k in range(4):
    y0 = 1.4 + k * 3.0
    lathe('Collar', [(y0, .92), (y0 + .4, .92)], 10, 20)
    lathe('Column', [(y0 + .4, .66), (y0 + 3.0, .66)], 10, 7, cap_top=False, cap_bottom=False)
lathe('Collar', [(13.4, .92), (13.8, .92)], 10, 20)
bevel_box('Cap', (0, 14.3, 0), (2.4, 1.0, 2.4), 1, .3)
lathe('Dome', [(14.8, 1.0), (15.3, .8), (15.6, .4), (15.7, 0)], 10, 20)
solid((0, 7.8, 0), (2.6, 15.6, 2.6))

# CATWALK (deck top at y = 0, front edge at z = +.9, 27.2 m long): a white deck on a charcoal trim with a warm light
# strip under its front edge, a yellow rail along the front, and yellow legs at x = +-6.5 and +-13.4 to the floor
# (their length set by the hall: legs are separate, Catwalk_Leg, 1 m tall, scaled in y).
model('Catwalk')
box('Deck', (0, -.15, 0), (27.2, .3, 1.8), 1)
box('Trim', (0, -.38, 0), (27.2, .16, 1.6), 0)
box('Strip', (0, -.3, .92), (27.0, .08, .04), 9)
for k in range(17):
    x = -13.5 + k * 27 / 16
    box('RailPost', (x, .5, .82), (.1, 1.0, .1), 11)
for y in (1.0, .55): box('RailBar', (0, y, .82), (27.2, .09, .09), 11)
box('Kick', (0, .08, .86), (27.2, .16, .04), 5)
passable('its deck runs 8.8 m up, out of reach; its legs stand on the floor')
model('Catwalk_Leg')
box('Leg', (0, .5, 0), (.34, 1.0, .34), 11)
solid((0, .5, 0), (.4, 1.0, .4))

# JIB CRANE (tower foot at the origin, jib along +X): a yellow lattice tower on a charcoal base, a white cab with a
# warm window, the jib with a hazard tip, a counter-jib with its weight, a trolley, the cable and a hazard crate
# hanging at x = 6, y = 5.
model('Crane')
bevel_box('Base', (0, .3, 0), (2.2, .6, 2.2), 0, .3)
for x in (-.6, .6):
    for z in (-.6, .6): box('Post', (x, 6.0, z), (.18, 11.4, .18), 11)
for y in [1.2 + k * 1.8 for k in range(6)]:
    for a, b, w, d in ((0, -.6, 1.3, .1), (0, .6, 1.3, .1), (-.6, 0, .1, 1.3), (.6, 0, .1, 1.3)): box('Brace', (a, y, b), (w, .1, d), 11)
bevel_box('Cab', (0, 12.2, .2), (1.6, 1.4, 1.6), 1, .2)
box('CabWindow', (.82, 12.3, .2), (.04, .6, 1.1), 9)
box('Jib', (3.4, 13.1, 0), (7.0, .5, .6), 11)
box('JibTip', (6.8, 13.1, 0), (.4, .54, .64), 5)
box('JibTop', (2.2, 13.6, 0), (4.4, .14, .14), 11)
box('CounterJib', (-1.5, 13.1, 0), (2.2, .5, .6), 11)
box('Weight', (-2.2, 12.5, 0), (1.0, .9, .8), 0)
box('Trolley', (6.0, 12.7, 0), (.7, .3, .7), 0)
box('Cable', (6.0, 9.15, 0), (.06, 6.8, .06), 13)
box('HookBar', (6.0, 5.7, 0), (1.0, .14, .14), 0)
bevel_box('Crate', (6.0, 5.0, 0), (1.2, 1.1, 1.2), 5, .12)
box('CrateLid', (6.0, 5.6, 0), (1.26, .1, 1.26), 0)
solid((0, .3, 0), (2.2, .6, 2.2)); solid((0, 6, 0), (1.7, 12, 1.7))  # the base and the tower; the crate hangs 4.4 m up

finish(__file__)
