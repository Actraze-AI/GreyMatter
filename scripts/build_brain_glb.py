"""Convert the Julich atlas .mz3 cortical hemispheres into a single brain.glb.

One-off build script. Reads:
    public/models/JulichBrainAtlas31_LH.mz3
    public/models/JulichBrainAtlas31_RH.mz3
Writes:
    public/models/brain.glb

The output is a combined cortical mesh in approximate MNI space so the region
anchors in lib/brainVisualization.ts (~ +/- 90 mm) line up with the geometry.
"""
from __future__ import annotations

import gzip
import struct
import sys
from pathlib import Path

import numpy as np
import trimesh


REPO_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = REPO_ROOT / "public" / "models"
LH_PATH = MODELS_DIR / "JulichBrainAtlas31_LH.mz3"
RH_PATH = MODELS_DIR / "JulichBrainAtlas31_RH.mz3"
OUT_PATH = MODELS_DIR / "brain.glb"

MZ3_MAGIC = 0x5A4D  # 'MZ' little-endian
ATTR_FACE = 1 << 0
ATTR_VERT = 1 << 1
ATTR_RGBA = 1 << 2
ATTR_SCALAR = 1 << 3
ATTR_DOUBLE = 1 << 4


def _maybe_decompress(data: bytes) -> bytes:
    if data[:2] == b"\x1f\x8b":
        return gzip.decompress(data)
    return data


def read_mz3(path: Path) -> tuple[np.ndarray, np.ndarray]:
    raw = _maybe_decompress(path.read_bytes())
    magic, attr, nface, nvert, nskip = struct.unpack_from("<HHIII", raw, 0)
    if magic != MZ3_MAGIC:
        raise ValueError(f"{path.name}: bad magic 0x{magic:04x}")
    if not (attr & ATTR_FACE) or not (attr & ATTR_VERT):
        raise ValueError(f"{path.name}: missing face or vertex data (attr={attr})")

    offset = 16 + nskip
    faces = np.frombuffer(raw, dtype="<i4", count=nface * 3, offset=offset).reshape(nface, 3)
    offset += nface * 3 * 4

    vert_dtype = "<f8" if attr & ATTR_DOUBLE else "<f4"
    vert_size = 8 if attr & ATTR_DOUBLE else 4
    verts = np.frombuffer(raw, dtype=vert_dtype, count=nvert * 3, offset=offset).reshape(nvert, 3)
    offset += nvert * 3 * vert_size

    return verts.astype(np.float32, copy=True), faces.astype(np.int32, copy=True)


def main() -> int:
    if not LH_PATH.exists() or not RH_PATH.exists():
        print(f"missing input meshes in {MODELS_DIR}", file=sys.stderr)
        return 1

    lh_v, lh_f = read_mz3(LH_PATH)
    rh_v, rh_f = read_mz3(RH_PATH)
    print(f"LH: {lh_v.shape[0]} verts / {lh_f.shape[0]} faces")
    print(f"RH: {rh_v.shape[0]} verts / {rh_f.shape[0]} faces")

    verts = np.vstack([lh_v, rh_v]).astype(np.float32)
    faces = np.vstack([lh_f, rh_f + lh_v.shape[0]]).astype(np.int64)

    centroid = verts.mean(axis=0)
    verts = verts - centroid

    # Compute smooth vertex normals manually (avoids scipy dependency).
    tri = verts[faces]
    face_normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    fn_norm = np.linalg.norm(face_normals, axis=1, keepdims=True)
    fn_norm[fn_norm == 0] = 1.0
    face_normals = face_normals / fn_norm
    vertex_normals = np.zeros_like(verts)
    for i in range(3):
        np.add.at(vertex_normals, faces[:, i], face_normals)
    vn_norm = np.linalg.norm(vertex_normals, axis=1, keepdims=True)
    vn_norm[vn_norm == 0] = 1.0
    vertex_normals = (vertex_normals / vn_norm).astype(np.float32)

    mesh = trimesh.Trimesh(
        vertices=verts,
        faces=faces,
        vertex_normals=vertex_normals,
        process=False,
    )

    print(f"combined: {mesh.vertices.shape[0]} verts / {mesh.faces.shape[0]} faces")
    print(f"bounds: min={mesh.bounds[0]} max={mesh.bounds[1]}")

    mesh.export(OUT_PATH)
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"wrote {OUT_PATH.relative_to(REPO_ROOT)} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
