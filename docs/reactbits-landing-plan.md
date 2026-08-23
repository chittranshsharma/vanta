# ReactBits Landing-Page Integration Plan

## Selected components

- `Animated Content` for a short hero entrance: opacity plus a subtle vertical transform only.
- `Scroll Reveal` for low-motion section entrances as each full-bleed landing tile enters the viewport.
- `Scroll Stack` for the five-step Vanta method narrative, only if it preserves the Apple-style gallery rhythm and keyboard/scroll accessibility.
- `Magnet` for the primary workspace CTA only, capped at a minimal displacement so it remains a button rather than a visual effect.
- `Noise` at extremely low opacity only if a final texture pass shows the flat surfaces need photographic warmth.

## Explicit exclusions

Do not use particle effects, glowing borders, liquid backgrounds, cursor trails, distortion, gradient text, count-up metrics, glitch/decryption text, hover glare, or 3D/card-gallery effects. They conflict with the approved Apple-inspired, photography-first, evidence-first direction.

## Motion rules

Use motion only to establish hierarchy. Keep all routine entrance motions under 240ms with no more than 12px travel, use opacity/transform only, avoid repeating loops, and respect `prefers-reduced-motion`. Motion must never hide content, delay keyboard use, or make unavailable capabilities appear active.
