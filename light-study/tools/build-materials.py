#!/usr/bin/env python3
"""Author deterministic seamless PBR materials for the mining light study.

All height fields are in metres. No directional lighting, fake slab joints,
ambient occlusion, or brick pattern is baked into the albedo. Modelled bevels
and joints supply those forms. The periodic fields only describe surface finish.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/materials"
ARTIFACT = ROOT / "artifacts/materials-asset.json"
OUT.mkdir(parents=True, exist_ok=True)
ARTIFACT.parent.mkdir(parents=True, exist_ok=True)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def field(n: int, cells: int, rng: np.random.Generator) -> np.ndarray:
    """Smooth, periodic value field with exact continuous boundary sampling."""
    values = rng.uniform(-1.0, 1.0, (cells, cells))
    t = np.arange(n) * cells / n
    a = np.floor(t).astype(int)
    w = t - a
    w = w * w * (3.0 - 2.0 * w)
    rows = values[a[:, None] % cells, a[None, :] % cells]
    right = values[a[:, None] % cells, (a[None, :] + 1) % cells]
    below = values[(a[:, None] + 1) % cells, a[None, :] % cells]
    diagonal = values[(a[:, None] + 1) % cells, (a[None, :] + 1) % cells]
    return ((rows * (1 - w)[None, :] + right * w[None, :]) * (1 - w)[:, None]
            + (below * (1 - w)[None, :] + diagonal * w[None, :]) * w[:, None])


def spots(n: int, count: int, rng: np.random.Generator,
          radius_range: tuple[float, float], stretch: float = 1.0) -> np.ndarray:
    u, v = np.meshgrid(np.arange(n) / n, np.arange(n) / n)
    result = np.zeros((n, n), dtype=np.float64)
    for _ in range(count):
        x, y = rng.random(2)
        radius = rng.uniform(*radius_range)
        dx = (u - x + 0.5) % 1.0 - 0.5
        dy = (v - y + 0.5) % 1.0 - 0.5
        result += np.exp(-0.5 * ((dx / radius) ** 2 + (dy / (radius * stretch)) ** 2))
    return np.minimum(result, 1.35)


def image_file(name: str, kind: str, data: np.ndarray) -> dict:
    path = OUT / f"{name}-{kind}.png"
    Image.fromarray(data).save(path, optimize=True)
    h, w = data.shape[:2]
    return {"file": path.name, "sha256": digest(path), "width": w, "height": h,
            "bytes": path.stat().st_size, "channels": 1 if data.ndim == 2 else data.shape[2]}


def authored_material(name: str, *, size: int, tile_m: float, seed: int,
                      color: str, roughness: float, kind: str) -> dict:
    rng = np.random.default_rng(seed)
    coarse = field(size, 4, rng)
    medium = field(size, 15, rng)
    fine = field(size, 58, rng)
    micro = field(size, 117, rng)
    broad_patches = spots(size, 7, rng, (0.025, 0.07), 1.6)
    u, v = np.meshgrid(np.arange(size) / size, np.arange(size) / size)

    if kind == "plaster":
        # Soft overlapping trowel ridges, shallow pinholes: no crack/dirt mask.
        strokes = np.sin(2 * np.pi * (u * 7 + v * 2 + 0.18 * coarse))
        trowel = np.maximum(strokes - 0.48, 0) ** 2
        pores = spots(size, 150, rng, (0.0009, 0.0025), 0.85)
        height = (0.0022 * coarse + 0.0014 * medium + 0.0008 * fine
                  + 0.00018 * micro + 0.0013 * trowel - 0.0011 * pores)
        # The ivory wall needs a quieter broad pigment field than the blue wall.
        pigment_coarse = 0.018 if name == "plaster_ivory" else 0.045
        pigment_patch = 0.010 if name == "plaster_ivory" else 0.018
        shade = 1 + pigment_coarse * coarse + 0.014 * medium + 0.004 * fine + pigment_patch * broad_patches
        rough = roughness + 0.026 * medium + 0.014 * fine + 0.016 * pores - 0.014 * trowel
        finish = "soft trowelled mineral plaster; shallow pores; broad quiet pigment"
    elif kind == "stone":
        # Low stone tool relief: colour does not encode the normal's direction.
        pores = spots(size, 110, rng, (0.0010, 0.0037), 1.1)
        tool = np.sin(2 * np.pi * (13 * u + 3 * v + 0.13 * coarse))
        height = (0.0016 * coarse + 0.0009 * medium + 0.00085 * fine
                  + 0.0002 * micro + 0.00024 * tool - 0.0011 * pores)
        shade = 1 + 0.045 * coarse + 0.018 * medium + 0.006 * fine + 0.018 * broad_patches
        rough = roughness + 0.032 * medium + 0.025 * fine + 0.02 * pores
        finish = "warm honed stone; soft tool and grain relief; occasional shallow pores"
    elif kind in ("wood", "painted_wood"):
        # Geometry gives U to the timber's long axis; grain runs along U.
        grain = np.sin(2 * np.pi * (v * 29 + 0.36 * np.sin(2 * np.pi * u) + 0.25 * medium))
        long_grain = np.sin(2 * np.pi * (v * 9 + 0.12 * np.sin(4 * np.pi * u)))
        painted = kind == "painted_wood"
        if not painted:
            # Unequal growth-band spacing and two softly mixed frequencies stop
            # the frame and bench from reading as regularly printed stripes.
            phase = (v * 25 + 0.62 * np.sin(4 * np.pi * v) + 0.30 * np.sin(10 * np.pi * v)
                     + 0.10 * np.sin(2 * np.pi * u) + 0.10 * medium)
            secondary = v * 41 + 0.30 * np.sin(6 * np.pi * v) + 0.09 * np.sin(4 * np.pi * u)
            grain = 0.64 * np.sin(2 * np.pi * phase) + 0.36 * np.sin(2 * np.pi * secondary)
        height = (0.00018 if painted else 0.00038) * grain + 0.00014 * long_grain + 0.00007 * fine
        shade = 1 + (0.012 if painted else 0.018) * grain + (0.010 if painted else 0.016) * coarse
        rough = roughness + (0.018 if painted else 0.035) * grain + 0.012 * medium
        finish = "opaque teal painted broad wood grain" if painted else "warm oiled broad wood grain"
    else:
        height = 0.00055 * coarse + 0.00035 * medium + 0.00018 * fine
        shade = 1 + 0.024 * coarse + 0.009 * medium
        rough = roughness + 0.022 * medium + 0.012 * fine
        finish = "unglazed warm terracotta with soft mineral relief"

    base = np.array([int(color[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)
    albedo = np.clip(np.rint(base[None, None, :] * shade[:, :, None]), 0, 255).astype(np.uint8)
    # Image rows run downward; uploaded Texture.flipY converts this to +V up.
    # Thus tangent +Y normal is +dHeight/dImageY, while +X is -dHeight/dImageX.
    pitch_m = tile_m / size
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) / (2 * pitch_m)
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) / (2 * pitch_m)
    normal = np.stack((-dx, dy, np.ones_like(height)), axis=2)
    normal /= np.linalg.norm(normal, axis=2)[:, :, None]
    normal_u8 = np.clip(np.rint((normal * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8)
    rough_u8 = np.clip(np.rint(rough * 255), 0, 255).astype(np.uint8)
    mean_color = np.rint(albedo.mean(axis=(0, 1))).astype(int)
    files = {"albedo": image_file(name, "albedo", albedo),
             "normal": image_file(name, "normal", normal_u8),
             "roughness": image_file(name, "roughness", rough_u8)}
    return {"name": name, "finish": finish, "tileMetres": tile_m,
            "baseColor": "#" + "".join(f"{x:02x}" for x in mean_color),
            "roughness": round(float(rough.mean()), 5), "metalness": 0,
            "normalConvention": "+Y tangent space (Three.js), RGB linear data",
            "heightRangeMetres": [round(float(height.min()), 7), round(float(height.max()), 7)],
            "heightRmsMetres": round(float(np.sqrt(np.mean(height ** 2))), 7),
            "normalSlopeP95": round(float(np.quantile(np.sqrt(dx * dx + dy * dy), 0.95)), 5),
            "roughnessRange": [round(float(rough.min()), 5), round(float(rough.max()), 5)],
            "maps": files}


def smooth_mask(values: np.ndarray, low: float, high: float) -> np.ndarray:
    t = np.clip((values - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def crafted_material(name: str, *, color: str, seed: int, plaster: bool) -> dict:
    """A second authored finish; baseline files remain byte-for-byte untouched.

    Large material changes and physical relief share fields, but none of them
    encode an illumination direction. Individual stone colour belongs to the
    mesh's per-slab linear vertex tint, rather than printed joints in a texture.
    """
    size, tile_m = 512, 2.0 if plaster else 1.5
    rng = np.random.default_rng(seed)
    broad = field(size, 3, rng)
    medium = field(size, 17 if plaster else 13, rng)
    grain = field(size, 42, rng)
    quiet = field(size, 97, rng)
    pigment = field(size, 5, rng)
    base = np.array([int(color[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)

    if plaster:
        # Broad overlapping coats, not isolated exposed-colour islands. Keep
        # grain out of the coat mask so fine relief cannot cut a ragged edge.
        mineral_field = 0.82 * broad + 0.18 * pigment
        coat = smooth_mask(mineral_field, -0.32, 0.48)
        pinholes = spots(size, 45, rng, (0.0018, 0.0037), 0.8)
        # Rounded overlapping trowel passes have readable 8–25 cm relief.
        # They affect normals/roughness, never pigment: no chipped-paint mask.
        trowel_field = 0.78 * medium + 0.22 * grain
        trowel = smooth_mask(trowel_field, -0.18, 0.30)
        height = (0.0018 * broad + 0.0028 * medium + 0.00065 * grain
                  + 0.00008 * quiet + 0.0045 * coat + 0.0055 * trowel - 0.0008 * pinholes)
        is_blue = name == "plaster_blue"
        mineral_color = np.array([151, 163, 169] if is_blue else [219, 210, 193], dtype=float)
        mix = coat * (0.14 if is_blue else 0.10)
        albedo_float = base[None, None, :] * (1 - mix[:, :, None]) + mineral_color * mix[:, :, None]
        shade = 1 + 0.026 * pigment + 0.010 * medium + 0.002 * grain
        albedo_float *= shade[:, :, None]
        rough = 0.83 + 0.025 * coat + 0.018 * medium + 0.008 * grain - 0.065 * trowel
        finish = "quiet mineral plaster; broad softly overlapping coats; shallow trowel relief; no isolated chalk islands"
    else:
        # Broader honed regions catch the lamp, while tool depressions remain
        # rougher. This is stone with varied finish, not a uniformly wet floor.
        honed = smooth_mask(0.7 * broad + 0.3 * pigment, -0.30, 0.40)
        pits = spots(size, 25, rng, (0.0030, 0.0100), 1.25)
        tool_field = 0.66 * medium + 0.22 * grain + 0.12 * broad
        tool_pits = smooth_mask(-tool_field, 0.19, 0.50)
        height = (0.0012 * broad + 0.0011 * medium + 0.00038 * grain + 0.000055 * quiet
                  - 0.0015 * tool_pits - 0.0010 * pits)
        shade = 1 + 0.045 * pigment + 0.027 * broad + 0.014 * medium + 0.003 * grain - 0.014 * pits
        albedo_float = base[None, None, :] * shade[:, :, None]
        rough = 0.66 - 0.225 * honed + 0.018 * medium + 0.024 * tool_pits + 0.012 * pits
        if name == "sandstone":
            rough += 0.075
        rough = np.clip(rough, 0.42, 0.77 if name == "sandstone" else 0.69)
        finish = "warm neutral stone; broad honed patches; medium tool pits and quiet grain"

    albedo = np.clip(np.rint(albedo_float), 0, 255).astype(np.uint8)
    pitch_m = tile_m / size
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) / (2 * pitch_m)
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) / (2 * pitch_m)
    normal = np.stack((-dx, dy, np.ones_like(height)), axis=2)
    normal /= np.linalg.norm(normal, axis=2)[:, :, None]
    normal_u8 = np.clip(np.rint((normal * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8)
    rough_u8 = np.clip(np.rint(rough * 255), 0, 255).astype(np.uint8)
    mean_color = np.rint(albedo.mean(axis=(0, 1))).astype(int)
    return {"name": name, "finish": finish, "tileMetres": tile_m,
            "baseColor": "#" + "".join(f"{x:02x}" for x in mean_color),
            "roughness": round(float(rough_u8.mean() / 255), 5), "metalness": 0,
            "normalConvention": "+Y tangent space (Three.js), RGB linear data",
            "heightRangeMetres": [round(float(height.min()), 7), round(float(height.max()), 7)],
            "heightRmsMetres": round(float(np.sqrt(np.mean(height ** 2))), 7),
            "normalSlopeP95": round(float(np.quantile(np.sqrt(dx * dx + dy * dy), 0.95)), 5),
            "roughnessRange": [round(float(rough.min()), 5), round(float(rough.max()), 5)],
            "maps": {"albedo": image_file("crafted-" + name, "albedo", albedo),
                     "normal": image_file("crafted-" + name, "normal", normal_u8),
                     "roughness": image_file("crafted-" + name, "roughness", rough_u8)}}


def budget_for(materials: dict) -> dict:
    maps = {m["file"]: m for asset in materials.values() for m in asset.get("maps", {}).values()}.values()
    return {"textureCount": len(maps), "downloadBytes": sum(m["bytes"] for m in maps),
            "baseLevelDecodedRGBABytes": sum(m["width"] * m["height"] * 4 for m in maps),
            "estimatedRGBAWithMipBytes": sum(m["width"] * m["height"] * 4 * 4 // 3 for m in maps)}


def main() -> None:
    materials = {}
    for name, kwargs in {
        "limestone": dict(size=512, tile_m=1.5, seed=801, color="d9cdae", roughness=.74, kind="stone"),
        "sandstone": dict(size=512, tile_m=1.5, seed=813, color="c4a174", roughness=.83, kind="stone"),
        "plaster_blue": dict(size=512, tile_m=2, seed=901, color="5c9bb6", roughness=.87, kind="plaster"),
        "plaster_ivory": dict(size=512, tile_m=2, seed=915, color="e0cda5", roughness=.88, kind="plaster"),
        "wood": dict(size=256, tile_m=1, seed=1221, color="a57040", roughness=.59, kind="wood"),
        "painted_wood": dict(size=256, tile_m=1, seed=1221, color="377b7b", roughness=.53, kind="painted_wood"),
        "terracotta": dict(size=256, tile_m=1, seed=1670, color="b66e50", roughness=.86, kind="clay"),
    }.items():
        materials[name] = authored_material(name, **kwargs)
    materials.update({
        "iron": {"name": "iron", "baseColor": "#303b43", "roughness": .47, "metalness": .72},
        "brass": {"name": "brass", "baseColor": "#bd8f43", "roughness": .37, "metalness": .85},
        "lampglass": {"name": "lampglass", "baseColor": "#ffe5ac", "roughness": .28,
                      "metalness": 0, "emissive": "#ffbf65", "emissiveIntensity": .48},
        "soil": {"name": "soil", "baseColor": "#514136", "roughness": 1, "metalness": 0},
        "leaf": {"name": "leaf", "baseColor": "#567a3c", "roughness": .93, "metalness": 0},
    })
    crafted = {name: crafted_material(name, **kwargs) for name, kwargs in {
        "limestone": dict(color="cbbfa5", seed=21801, plaster=False),
        "sandstone": dict(color="b89b76", seed=21813, plaster=False),
        "plaster_blue": dict(color="628aa2", seed=21901, plaster=True),
        "plaster_ivory": dict(color="d5c5a7", seed=21915, plaster=True),
    }.items()}
    total_budget = budget_for({**materials, **{"crafted-" + k: v for k, v in crafted.items()}})
    manifest = {
        "version": 2, "generator": "tools/build-materials.py", "generatorSha256": digest(Path(__file__)),
        "authoring": "Original deterministic procedural PBR textures; no external/generated model service",
        "uvConvention": "one mesh UV unit equals one metre; repeat=1/tileMetres",
        "filtering": "linear magnification, trilinear mipmaps, anisotropy 4",
        "albedoColorSpace": "sRGB", "normalRoughnessColorSpace": "linear data / NoColorSpace",
        "materials": materials,
        "variants": {"crafted": {"materials": crafted}},
        "variantBudgets": {"baseline": budget_for(materials), "crafted": budget_for({**materials, **crafted})},
        "budget": total_budget,
    }
    target = OUT / "materials.json"
    target.write_text(json.dumps(manifest, indent=2) + "\n")
    artifact = {"version": 2, "source": {"path": "tools/build-materials.py", "sha256": digest(Path(__file__))},
                "loader": {"path": "src/materials.ts", "sha256": digest(ROOT / "src/materials.ts")},
                "manifest": {"path": "public/assets/materials/materials.json", "sha256": digest(target)},
                "textureCount": total_budget["textureCount"], "budget": manifest["budget"],
                "validation": {"periodicFields": True, "normalsFromMetreHeight": True,
                               "bakedLighting": False, "bakedSlabJoints": False},
                "materials": materials, "variants": manifest["variants"], "variantBudgets": manifest["variantBudgets"]}
    ARTIFACT.write_text(json.dumps(artifact, indent=2) + "\n")
    print(json.dumps({"manifestSha256": digest(target), **manifest["budget"]}, indent=2))


if __name__ == "__main__":
    main()
