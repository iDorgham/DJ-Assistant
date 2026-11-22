# EQ8 and CUE

Last updated: 2026-10-23  
Status: Locked behavior; exact frequency defaults proposed

## 1. EQ8

EQ8 is an eight-band equalizer, not a three-band DJ isolator.

```text
Band 1  Low shelf
Band 2  Peak
Band 3  Peak
Band 4  Peak
Band 5  Peak
Band 6  Peak
Band 7  Peak
Band 8  High shelf
```

Each band has:

- Frequency
- Gain
- Q / slope
- Enable
- Reset
- Numeric value
- Keyboard adjustment

## 2. Default frequency layout

Proposed starting points:

| Band | Type | Default frequency |
|---|---|---|
| 1 | Low shelf | 80 Hz |
| 2 | Peak | 160 Hz |
| 3 | Peak | 320 Hz |
| 4 | Peak | 640 Hz |
| 5 | Peak | 1.2 kHz |
| 6 | Peak | 2.5 kHz |
| 7 | Peak | 5 kHz |
| 8 | High shelf | 10 kHz |

Rules:

- Frequencies are adjustable.
- Defaults can change without breaking saved presets.
- Show Hz/kHz.
- Show gain in dB.
- Clamp to safe ranges.
- Bypass is obvious.
- Reset all.
- A/B compare optional.
- No hidden normalization.
- No hidden limiter.

## 3. EQ8 UI

```text
EQ8
  80   160   320   640   1.2k  2.5k  5k   10k
  [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]  [ ]
  -12   -6     0    +6   +12 dB
```

- Knobs or sliders.
- Frequency labels.
- Gain readout.
- Q readout.
- Double-click resets a band.
- Right-click opens reset/bypass.
- Keyboard: arrows adjust; Shift for fine.
- Screen-reader labels include band, frequency, gain.
- High contrast.
- No color-only state.

## 4. EQ8 scope

- EQ8 state belongs to the player session, not the track.
- Changing tracks does not reset EQ8 unless the user chooses.
- Presets are optional.
- EQ8 is not written to the track metadata.
- EQ8 is not included in sync or USB export.
- EQ8 settings can be saved as a player preset.
- Do not claim EQ8 is an isolator.
- Do not fake eight bands with a three-band UI.

## 5. CUE behavior

CUE follows Traktor-style behavior.

| State | CUE press |
|---|---|
| Stopped, no cue | Set cue at playhead |
| Stopped, cue exists | Jump to cue |
| Playing | Return to cue and pause |
| Playing, cue moved | Set new cue only with explicit set action |

Rules:

- CUE is not a stop button.
- CUE is a cue-point control.
- The cue point is visible on the waveform.
- The cue point persists per track.
- CUE changes are part of the track state.
- CUE can be quantized.
- CUE can be locked to the beat grid.
- CUE behavior is consistent across all player presentations.

## 6. Hot cues

- 8 hot cues by default.
- Configurable count later.
- Set while stopped or playing.
- Trigger while playing.
- Trigger while paused jumps to the cue.
- Color per cue.
- Name per cue.
- Delete with context menu or modifier.
- Clear all with confirmation.
- Persist per track.
- Sync where supported.
- Keyboard shortcuts.
- MIDI mapping later.

## 7. Loops

- Manual loop in/out.
- Beat loop: 1/32 to 32 beats.
- Loop active/inactive.
- Loop move.
- Loop resize.
- Loop quantization.
- Loop color.
- Loop persists only if the user saves it.
- Do not fake loops without a beat grid.

## 8. Beat grid

- Downbeat.
- Bar markers.
- Phrase markers.
- Grid offset.
- BPM.
- Manual nudge.
- Re-analyze.
- Stale analysis warning.
- CUE and loops snap to grid when quantization is on.

## 9. Quantization

Options:

- Off.
- 1/4 beat.
- 1/2 beat.
- 1 beat.
- 1 bar.

Rules:

- Show the current quantization.
- Quantize CUE, hot cues, loops and beat jump.
- Do not quantize if no grid exists.
- Do not silently move cues.

## 10. Persistence

Persist:

- Cue point.
- Hot cues.
- Loop points if saved.
- Cue colors.
- Cue names.
- Quantization per track or global.

Do not persist:

- Playhead position unless the user enables resume.
- EQ8 per track.
- Temporary loop state.

## 11. Sync and publish

- Cues and loops can be pulled from DJ apps.
- Cues and loops can be pushed where the adapter supports it.
- Conflicts are reviewed.
- CUE data is not written to USB unless the target format supports it.
- OneLibrary cue support is experimental until validated.
- Serato cue support requires validation.

## 12. Accessibility

- CUE button has a label.
- Hot cues have labels and positions.
- Color is not the only cue identifier.
- Keyboard shortcuts are documented.
- Screen reader announces cue changes.
- Focus ring visible.
- Reduced motion does not remove cue markers.

## 13. Anti-patterns

- Three-band EQ labeled EQ8.
- CUE acting as Stop.
- Cues that disappear when switching layouts.
- Cues that do not persist.
- Quantization that silently moves cues.
- Loops without a beat grid.
- Color-only cue identification.
- Writing cue data to a format that does not support it.
