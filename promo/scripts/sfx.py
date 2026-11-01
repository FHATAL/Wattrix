"""Synthesises the ad's sound-effect bed from src/timeline.json -> public/audio/sfx.wav.

Pure numpy, no samples, so there is nothing to license. Run: python3 scripts/sfx.py
"""
import json
import pathlib
import wave

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "src" / "timeline.json").read_text())
SR = 48000
FPS = TL["fps"]
N = int(TL["total"] / FPS * SR) + SR
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be an array (Hz) for sweeps."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def env(n, attack, release_curve=3.0):
    t = np.linspace(0, 1, n)
    a = max(1, int(attack * SR))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    e *= (1 - t) ** release_curve
    return e


def whoosh(length=0.55, up=True):
    n = int(length * SR)
    noise = rng.standard_normal(n)
    sweep = np.geomspace(300, 6000, n) if up else np.geomspace(6000, 300, n)
    body = lowpass(noise, sweep) - lowpass(noise, sweep * 0.25)
    t = np.linspace(0, 1, n)
    shape = np.sin(np.pi * t) ** 1.6
    pan = np.linspace(-0.6, 0.6, n)
    sig = body * shape * 1.6
    return np.stack([sig * (1 - pan) / 2 + sig / 2, sig * (1 + pan) / 2 + sig / 2], 1)


def impact(length=0.9):
    n = int(length * SR)
    t = np.arange(n) / SR
    freq = 90 * np.exp(-t * 6) + 42
    phase = 2 * np.pi * np.cumsum(freq) / SR
    thump = np.sin(phase) * np.exp(-t * 5.5)
    click = lowpass(rng.standard_normal(n), 2500) * np.exp(-t * 60) * 0.8
    sig = np.tanh((thump + click) * 1.8) * 0.9
    return np.stack([sig, sig], 1)


def slash(length=0.35):
    n = int(length * SR)
    noise = rng.standard_normal(n)
    hi = noise - lowpass(noise, 2500)
    sig = hi * env(n, 0.004, 2.2) * 0.9
    return np.stack([sig * 0.8, sig], 1)


def tick(length=0.08):
    n = int(length * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 90) * 0.35
    return np.stack([sig, sig], 1)


def riser(frames):
    n = int(frames / FPS * SR)
    noise = rng.standard_normal(n)
    sweep = np.geomspace(200, 7000, n)
    sig = lowpass(noise, sweep) - lowpass(noise, sweep * 0.3)
    t = np.linspace(0, 1, n)
    tone = np.sin(2 * np.pi * np.cumsum(np.geomspace(110, 440, n)) / SR) * 0.25
    sig = (sig * 0.8 + tone) * t ** 2.2
    return np.stack([sig, sig], 1)


def swoosh():
    return whoosh(0.4, up=False) * 0.7


def chime(length=1.6):
    n = int(length * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for f0, amp in [(659.25, 0.5), (987.77, 0.35), (1318.5, 0.2)]:
        sig += amp * np.sin(2 * np.pi * f0 * t) * np.exp(-t * 2.6)
    sig *= np.minimum(1, t * 200) * 0.45
    return np.stack([sig, np.roll(sig, int(0.012 * SR))], 1)


MAKERS = {
    "whoosh": lambda e: whoosh(),
    "impact": lambda e: impact(),
    "slash": lambda e: slash(),
    "tick": lambda e: tick(),
    "riser": lambda e: riser(e.get("len", 30)),
    "swoosh": lambda e: swoosh(),
    "chime": lambda e: chime(),
}

for ev in TL["sfx"]:
    clip = MAKERS[ev["kind"]](ev)
    start = int(ev["t"] / FPS * SR)
    end = min(N, start + len(clip))
    mix[start:end] += clip[: end - start]

# Gentle sub drone bed so silence between hits is not dead air.
t = np.arange(N) / SR
drone = 0.05 * np.sin(2 * np.pi * 55 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.25 * t))
fade = np.minimum(1, t / 1.0) * np.clip((TL["total"] / FPS - t) / 1.2, 0, 1)
mix += np.stack([drone * fade, drone * fade], 1)

mix = mix[: int(TL["total"] / FPS * SR)]
peak = np.max(np.abs(mix))
mix = mix / peak * 0.89  # about -1 dBFS; loudness is normalised in the final mux
out = ROOT / "public" / "audio" / "sfx.wav"
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", out, f"{len(mix) / SR:.2f}s")
