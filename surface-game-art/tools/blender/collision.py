"""How each prop collides, defined in the function that builds it, right after its parts: boxes or convex hulls in
the prop's own frame (three's x, y, z, metres), its own triangles, or nothing. Every prop must say one of these;
`write()` refuses to export a kit with a prop that does not. The decision rides on the prop root as glTF extras
(`collision`); the scene builds place it with the prop (src/game/world/propCollision.ts):
  tools/build-underground.mjs for the halls and bases, tools/export-pinewind-scene.mjs for Pinewind.

  solid(root, at, size, yaw=0)      a box: centre and full size, turned round Y
  solid_of(root, parts=None, hull=False)
                                    the box (or convex hull) round some parts already built: objects, name prefixes
                                    (every part whose name starts so), or all of the prop's if None
  mesh_solid(root)                  the prop's own triangles (a bridge deck to walk on)
  passable(root, reason)            nothing: decor the character walks through or never reaches
"""
import json, math, bmesh
from mathutils import Vector

_DECISIONS = {}

def _decision(root):
    return _DECISIONS.setdefault(root.as_pointer(), {'solids': []})

def _three(v):
    return (v.x, v.z, -v.y)

def _r(values, digits=4):
    return [round(v, digits) + 0 for v in values]

def solid(root, at, size, yaw=0):
    _decision(root)['solids'].append({'at': _r(at), 'half': _r([s / 2 for s in size]), 'yaw': round(yaw, 5)})

def _points(root, parts):
    import bpy
    bpy.context.view_layer.update()
    own = [o for o in root.children_recursive if o.type == 'MESH']
    if isinstance(parts, str): parts = [parts]
    meshes = [m for p in parts for m in ([o for o in own if o.name.startswith(p)] if isinstance(p, str) else [p])] if parts else own
    to_root = root.matrix_world.inverted()
    points = []
    for ob in meshes:
        m = to_root @ ob.matrix_world
        points += [_three(m @ v.co) for v in ob.data.vertices]
    assert points, f'{root.name}: no parts to collide with ({parts})'
    return points

def solid_of(root, parts=None, hull=False):
    points = _points(root, parts)
    lo = [min(p[k] for p in points) for k in range(3)]; hi = [max(p[k] for p in points) for k in range(3)]
    at = [(a + b) / 2 for a, b in zip(lo, hi)]
    entry = {'at': _r(at), 'half': _r([(b - a) / 2 for a, b in zip(lo, hi)]), 'yaw': 0}
    if hull:
        bm = bmesh.new()
        for p in points: bm.verts.new(p)
        result = bmesh.ops.convex_hull(bm, input=list(bm.verts))
        kept = list(dict.fromkeys(v for v in result['geom'] if isinstance(v, bmesh.types.BMVert)))  # in order: same bytes every build
        entry['hull'] = _r([c for v in kept for c in (v.co.x - at[0], v.co.y - at[1], v.co.z - at[2])])
        bm.free()
    _decision(root)['solids'].append(entry)

def mesh_solid(root):
    _decision(root)['mesh'] = True

def passable(root, reason):
    _decision(root)['passable'] = reason

def write(roots):
    """Check every prop decided and store each decision on its root (exported with export_extras)."""
    missing = [r.name for r in roots if not (lambda d: d and (d['solids'] or d.get('mesh') or d.get('passable')))(_DECISIONS.get(r.as_pointer()))]
    assert not missing, f'props without a collision decision (solid, solid_of, mesh_solid or passable): {missing}'
    for r in roots:
        d = _DECISIONS[r.as_pointer()]
        assert not (d.get('passable') and (d['solids'] or d.get('mesh'))), f'{r.name}: passable and solid'
        r['collision'] = json.dumps({k: v for k, v in d.items() if v}, separators=(',', ':'))
    return {r.name: _DECISIONS[r.as_pointer()].get('passable') or len(_DECISIONS[r.as_pointer()]['solids']) or 'mesh' for r in roots}

def uncovered(root, low=.35, high=1.6):
    """The prop's parts at body height (reaching from `low` to `high` m) that no collider's box touches: a check
    for props whose colliders were placed by hand (an attached crate, a porch post)."""
    d = _DECISIONS.get(root.as_pointer())
    if not d or d.get('passable') or d.get('mesh'): return []
    boxes = []
    for s in d['solids']:
        c, n = abs(math.cos(s['yaw'])), abs(math.sin(s['yaw']))  # a turned box's footprint
        h = [c * s['half'][0] + n * s['half'][2], s['half'][1], n * s['half'][0] + c * s['half'][2]]
        boxes.append([[s['at'][k] - h[k] for k in range(3)], [s['at'][k] + h[k] for k in range(3)]])
    out = []
    for ob in [o for o in root.children_recursive if o.type == 'MESH']:
        pts = _points(root, [ob]); lo = [min(p[k] for p in pts) for k in range(3)]; hi = [max(p[k] for p in pts) for k in range(3)]
        if lo[1] > high or hi[1] < low: continue
        if not any(all(lo[k] < b[1][k] + .05 and hi[k] > b[0][k] - .05 for k in range(3)) for b in boxes): out.append(ob.name)
    return out
