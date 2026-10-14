# BUNNY SIGNAL

A browser instrument for generative glitch music, built with native Web Audio, Canvas, and a little dancing bunny. No external scripts, fonts, or sample downloads.

The six voices are synthesized kick, snare, metallic hats, two-operator FM bass, FM bells, and a granular cloud with a tonal anchor. The cloud accepts an imported audio file. Four scenes share an editable 16-step sequencer with scale degrees, velocity, probability, and ratchets. Evolution respects voice locks; scene changes quantize to the next bar.

The patch bay maps a slow clocked LFO, a beat envelope, sample-and-hold randomness, and the performance XY pad to synthesis and effect parameters. The signal path contains high-pass and low-pass filtering, saturation, a parallel bitcrusher, stereo feedback delay, convolution reverb, compression, and bounded output. The bitcrusher uses an AudioWorklet where available and a quantization curve elsewhere. Offline rendering uses the same synthesis graph; environments without offline worklets omit the crusher's sample-rate reduction.

## Play

Serve the repository root from an HTTPS origin (or localhost), then open `index.html`. Press **Let's play** to enable audio. Tap a step to toggle it; hold or right-click to edit it. Drag knobs vertically. Patch a source to a destination. Hold the performance pads for stutter, reverse, tape slowdown, and octave sparkle.

**Space** starts/stops; **R** generates; **G** holds stutter; **K / B / L** audition kick, bass, and bell. On a phone, swipe the sequencer horizontally. CALM reduces visual motion. Day/night colors affect only the visualizer.

## Keep a session

The browser saves patterns and parameters in local storage. Session JSON files allow transfer and reopening. Imported samples remain in memory for the current visit and are not embedded in session JSON. WAV exports include imported sounds and the effect tail. Live recording uses the browser's supported MediaRecorder format.

## Files

- `index.html` — interface and accessible dialogs
- `styles.css` — responsive rack layout
- `engine.js` — composition, synthesis, validation, and WAV encoder
- `crusher.js` — stereo AudioWorklet bitcrusher
- `app.js` — sequencing, interaction, persistence, recording, and canvas visualization

## Verification

Offline audio rendering checked all four presets, stereo signal routing, finite samples, bounded output, and effect extremes. Composition checks covered deterministic generation, swing timing, safe session validation, and locked-voice mutation. DOM interaction checks covered step editing, undo, mute/solo/lock, presets, scenes, patching, keyboard knobs, XY controls, performance pads, session downloads, autosave, transport, and WAV export. Physical browser and device testing was not available in the authoring environment.

## GitHub Pages

The public website deploys from the `main` branch, repository root. The application has no build step or external dependencies. All six voices and uploaded samples process locally in the visitor’s browser.
