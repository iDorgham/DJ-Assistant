#!/usr/bin/env python3
"""Generate the deterministic ONNX smoke-test model used by the analysis crate.

Output: ``fixtures/models/smoke_test.onnx`` -- a 61-byte, dependency-free ONNX
``ModelProto`` that the analysis engine loads and runs to prove the ONNX Runtime is
wired up correctly.  The graph is the smallest op the runtime is known to support::

    ir_version = 7
    graph "g"
        node: op_type "Relu", input "x", output "y"
        value_info "x": tensor(float)[1]
        value_info "y": tensor(float)[1]
    opset_import: "" version 7

Why ``Relu`` and not ``Identity``
---------------------------------
``Identity`` is the obvious smoke-test choice, but the ONNX Runtime bundled with
Microsoft Edge WebView2 (a common, zero-install Windows fallback that
``find_onnxruntime_dylib`` discovers) is an operator-trimmed build that rejects
``Identity`` with *"Could not find an implementation for Identity(1)"*.  ``Relu`` is
present in that build, so the smoke test uses it and feeds a **positive** input, for
which ``Relu(x) == x``.  Inference therefore still proves "model executes and returns
the input unchanged" without depending on an op the trimmed runtime lacks.

Why hand-encode protobuf instead of using the ``onnx`` Python package
---------------------------------------------------------------------
The ``onnx`` wheel is a large compiled dependency and is not part of this repo's
toolchain (the same reason the audio fixture generator hand-builds tags).  A minimal
single-op model is small enough to encode unambiguously with the handful of protobuf
wire helpers below.  The bytes are a pure function of the constants in this file, so
regeneration is byte-stable and the SHA-256 is pin-able.

The digest is mirrored in Rust by ``dj_assistant_analysis::ModelSpec::smoke_test()``
(and pinned again by a fixture-integrity test).  Run this script after changing the
model and copy the printed digest into that spec.

Exit status is 0 only when the freshly written bytes match ``EXPECTED_SHA256`` and the
file on disk matches those bytes.
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

# The digest consumers pin.  Kept in sync with ModelSpec::smoke_test() in
# crates/analysis/src/registry.rs; the analysis fixture test fails loudly on drift.
EXPECTED_SHA256 = "5bd717dd17f1a40364178ea8aff2017dabc1221b13b681cd8d1a6809af1b5196"

# Must stay a single-input/single-output op that the trimmed Edge WebView2 ONNX Runtime
# also implements. See the module docstring before changing this.
SMOKE_OP_TYPE = "Relu"

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_REL = Path("fixtures") / "models" / "smoke_test.onnx"


# --- Minimal protobuf wire encoding -------------------------------------------------


def _varint(value: int) -> bytes:
    if value < 0:
        raise ValueError("varint cannot encode negative values")
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def _tag(field_number: int, wire_type: int) -> bytes:
    return _varint((field_number << 3) | wire_type)


def _length_delimited(field_number: int, payload: bytes) -> bytes:
    return _tag(field_number, 2) + _varint(len(payload)) + payload


def _string(field_number: int, value: str) -> bytes:
    return _length_delimited(field_number, value.encode("utf-8"))


def _int(field_number: int, value: int) -> bytes:
    return _tag(field_number, 0) + _varint(value)


# --- ONNX message builders ----------------------------------------------------------


def _tensor_float_shape_1() -> bytes:
    """TypeProto for tensor(float) with shape [1]."""
    dim = _int(1, 1)  # TensorShapeProto.Dimension.dim_value = 1
    shape = _length_delimited(1, dim)  # TensorShapeProto.dim
    tensor_type = _int(1, 1) + _length_delimited(2, shape)  # elem_type FLOAT, shape
    return _length_delimited(1, tensor_type)  # TypeProto.tensor_type


def _value_info(name: str) -> bytes:
    return _string(1, name) + _length_delimited(2, _tensor_float_shape_1())


def _graph() -> bytes:
    node = (
        _string(1, "x")  # NodeProto.input
        + _string(2, "y")  # NodeProto.output
        + _string(4, SMOKE_OP_TYPE)  # NodeProto.op_type
    )
    return (
        _length_delimited(1, node)  # GraphProto.node
        + _string(2, "g")  # GraphProto.name
        + _length_delimited(11, _value_info("x"))  # GraphProto.input
        + _length_delimited(12, _value_info("y"))  # GraphProto.output
    )


def build_model() -> bytes:
    opset = _string(1, "") + _int(2, 7)  # OperatorSetIdProto: domain "", version 7
    return (
        _int(1, 7)  # ModelProto.ir_version
        + _length_delimited(7, _graph())  # ModelProto.graph
        + _length_delimited(8, opset)  # ModelProto.opset_import
    )


def main() -> int:
    data = build_model()
    digest = hashlib.sha256(data).hexdigest()
    output = REPO_ROOT / OUTPUT_REL

    print(f"model bytes : {len(data)}")
    print(f"sha256      : {digest}")

    status = 0
    if digest != EXPECTED_SHA256:
        print(
            f"[determinism] FAIL: expected {EXPECTED_SHA256}, got {digest}. "
            "Update EXPECTED_SHA256 here and ModelSpec::smoke_test() in registry.rs.",
            file=sys.stderr,
        )
        status = 1

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)

    on_disk = output.read_bytes()
    if on_disk != data:
        print("[determinism] FAIL: written file does not match generated bytes", file=sys.stderr)
        status = 1

    print(f"wrote       : {OUTPUT_REL.as_posix()}")
    return status


if __name__ == "__main__":
    raise SystemExit(main())
