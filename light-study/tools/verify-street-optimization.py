"""Compare published renders and verify their artifact/scope provenance.

Run after check-street-optimization.cjs. No browser or rendering is performed
here: inputs are screenshots, snapshots, shader captures and release hashes.
"""
import hashlib
import json
import statistics
from pathlib import Path

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
base = root / "artifacts/lighting-optimization"
final = base / "final"
report = json.loads((final / "report.json").read_text())
assert report.get("completedAt"), report.get("failure", "Incomplete browser validation")
assert not report["errors"] and not report["warnings"]
reference, optimized = report["variants"]
assert [reference["variant"], optimized["variant"]] == ["reference", "optimized"]
result = {"source": "final/report.json", "comparisons": {}, "performance": {}}


def compare(a, b, name):
    left = np.asarray(Image.open(a).convert("RGB"), dtype=np.int16)
    right = np.asarray(Image.open(b).convert("RGB"), dtype=np.int16)
    assert left.shape == right.shape, name
    diff = np.abs(left - right)
    maximum = diff.max(axis=2)
    stats = {
        "meanChannelDifferenceOutOf255": float(diff.mean()),
        "maxChannelDifferenceOutOf255": int(diff.max()),
        "pixelsChanged": int(np.count_nonzero(maximum)),
        "pixelsDifferenceAbove1": int(np.count_nonzero(maximum > 1)),
        "fractionPixelsDifferenceAbove3": float(np.count_nonzero(maximum > 3) / maximum.size),
    }
    result["comparisons"][name] = stats
    Image.fromarray(np.minimum(diff * 16, 255).astype(np.uint8)).save(final / (name + "-difference-x16.png"))
    return stats


for view in reference["views"]:
    name = view["name"]
    stats = compare(final / reference["label"] / (name + ".png"), final / optimized["label"] / (name + ".png"), name)
    # Tight image guard: AO sample resolve can alter a few quantized edge values.
    # All other lighting/material/geometry inputs must remain unchanged.
    day = name.startswith("day-")
    assert stats["meanChannelDifferenceOutOf255"] < (.1 if day else .02), (name, stats)
    assert stats["maxChannelDifferenceOutOf255"] <= (10 if day else 2), (name, stats)
    assert stats["fractionPixelsDifferenceAbove3"] < .001, (name, stats)

stats = compare(base / "baseline/full.png", final / reference["label"] / "night-entrance.png", "original-reference")
assert stats["maxChannelDifferenceOutOf255"] == 0

for item in report["variants"]:
    for name in ["night-restored", "night-ao-restored"] + (["night-controls-restored"] if item is optimized else []):
        stats = compare(final / item["label"] / "night-entrance.png", final / item["label"] / (name + ".png"), item["variant"] + "-" + name)
        assert stats["maxChannelDifferenceOutOf255"] == 0, (item["variant"], name, stats)
    frames = item["frames"]
    assert len(frames) >= 3
    for frame in frames:
        assert frame["viewport"]["bufferWidth"] == 1440 and frame["viewport"]["bufferHeight"] == 900
        assert frame["gpuSampleFrame"] == frame["submitted"]
        assert frame["model"]["triangles"] == 117156 and frame["model"]["batches"] == 19
        assert frame["render"]["drawCalls"] == 48 and frame["render"]["frameCalls"] == 8
        assert frame["lighting"]["shadowMode"] == "static visibility atlas"
        assert frame["lighting"]["targets"][0]["samples"] == (0 if item is optimized else 4)
        assert frame["lighting"]["targets"][1]["samples"] == 4
        assert all(lamp["visible"] for lamp in frame["lighting"]["lamps"])
    assert all(lamp["visible"] == (item is reference) for lamp in item["dayFrame"]["lighting"]["lamps"])
    result["performance"][item["variant"]] = {
        "adapter": frames[0]["adapter"],
        "totalMs": [frame["gpuMs"] for frame in frames],
        "totalMedianMs": statistics.median(frame["gpuMs"] for frame in frames),
        "mainMedianMs": statistics.median(next(p["ms"] for p in frame["gpuPasses"] if p["label"] == "Lighting + shadows") for frame in frames),
        "normalsMedianMs": statistics.median(next(p["ms"] for p in frame["gpuPasses"] if p["label"] == "Geometry normals") for frame in frames),
        "dayWarmFrameMs": item["dayFrame"]["gpuMs"],
        "threeMemoryEstimateBytes": frames[-1]["memory"]["total"],
    }
    for bundle in item["bundles"]:
        path = root / "dist/assets" / bundle["url"].split("/")[-1]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == bundle["sha256"], path

optimized_shaders = [path.read_text() for path in (final / optimized["label"] / "shaders").glob("*.wgsl")]
assert any("fn streetPMREMIrradiance" in shader and "fn streetPMREMRadiance" in shader for shader in optimized_shaders)

before = json.loads((base / "before/asset-manifest.json").read_text())
for asset in before["resources"]:
    assert hashlib.sha256((root / asset["file"]).read_bytes()).hexdigest() == asset["sha256"], asset["file"]
scope = json.loads((base / "before/scope.json").read_text())
for filename, digest in scope.items():
    assert hashlib.sha256((root.parent / filename).read_bytes()).hexdigest() == digest, filename
release = json.loads((root / "artifacts/public-release.json").read_text())
before_release = json.loads((base / "before/public-release.json").read_text())
assert release["otherGamesUnchanged"]
assert before_release["protectedManifestSha256"] == release["protectedManifestSha256"]
result["unchangedResources"] = len(before["resources"])
result["unchangedWorkspaceFiles"] = len(scope)
result["protectedPublishedFiles"] = release["protectedFiles"]
result["performance"]["totalReductionPercent"] = 100 * (1 - result["performance"]["optimized"]["totalMedianMs"] / result["performance"]["reference"]["totalMedianMs"])
result["limit"] = "SwiftShader validation, not laptop hardware GPU acceptance. No multiple-light scaling claim."
(final / "verification.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
