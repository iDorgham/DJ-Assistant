# Player Settings and Accessibility

Last updated: 2026-10-23  
Status: Proposed

## 1. Audio settings

```text
Audio output
  Device: [ System default ]
  Sample rate: [ 48,000 Hz ]
  Buffer: [ 512 samples ]
  Latency: 12 ms
  Channels: Stereo

[ Test audio ]
```

Rules:

- List real devices.
- Show unavailable devices.
- Handle device disconnect.
- Do not fake a device.
- Do not silently change sample rate.
- Warn if the device does not support the selected rate.
- Test tone uses the current output.

## 2. Playback settings

- Default presentation.
- Open playlist in Player view.
- Remember playhead position.
- Resume after restart.
- Crossfade? Out of scope unless implemented.
- Key lock.
- Quantization.
- Beat jump size.
- Loop size.
- Hot cue count.
- CUE behavior.
- Waveform style.
- Waveform zoom.
- Follow playhead.
- Show phrase markers.
- Show beat grid.
- Show key in Camelot or musical notation.

## 3. Loudness

Defaults:

- Normalization: off.
- Limiter: off.
- Auto-gain: off.

Rules:

- Do not apply loudness normalization silently.
- Do not apply limiting silently.
- If enabled, show it clearly in the player.
- Do not alter exported audio.
- Do not confuse playback gain with file gain.

## 4. Key notation

Options:

- Musical: `8A`? No, musical is `A minor`; Camelot is `8A`.
- Camelot: `8A`.
- Both.

Rules:

- Use the same notation in Library, Set Score, Statistics and Discover.
- Do not mix notations on one screen.
- Explain the notation in settings.
- Key analysis confidence can be shown.

## 5. Waveform and motion

- Waveform style.
- Color mode.
- Zoom.
- Follow playhead.
- Animate playhead.
- Reduced motion.
- High contrast.
- Static waveform option.
- Phrase marker density.

Reduced motion:

- Disable animated zoom.
- Disable pulsing.
- Keep playhead movement necessary for playback.
- Keep cue markers visible.

## 6. Accessibility

### Keyboard

- `Space` — play/pause.
- `Left/Right` — seek.
- `Shift + Left/Right` — fine seek.
- `Up/Down` — volume.
- `C` — CUE.
- `1–8` — hot cues.
- `L` — loop.
- `M` — mute.
- `Esc` — close panel.
- `Ctrl/Cmd + S` — save playlist.

Shortcuts should be configurable where practical.

### Screen readers

- Announce track changes.
- Announce play/pause.
- Announce cue changes.
- Announce loop state.
- Announce errors.
- Label every control.
- Provide text alternatives for waveform and charts.
- Do not rely on color.

### Focus

- Visible focus ring.
- Logical tab order.
- Focus returns after dialogs.
- No focus traps.
- Player controls reachable from every tab.
- Skip-to-content link.

### Contrast and text

- WCAG 2.2 AA minimum.
- High-contrast theme.
- Scalable text.
- No text in images.
- Minimum target size.
- Clear disabled states.

### Motion

- Respect `prefers-reduced-motion`.
- Avoid flashing.
- Avoid parallax.
- Keep essential playhead motion.
- Provide a static waveform.

## 7. Performance settings

- Waveform cache size.
- Artwork cache size.
- Analysis threads.
- Preload next track.
- Background analysis.
- Battery saver.
- Hardware acceleration.
- Debug overlay (advanced).

Rules:

- Do not let cache growth consume the disk silently.
- Show cache size.
- Clear cache.
- Rebuild cache.
- Cache is not backed up.

## 8. Diagnostics

- Audio device.
- Sample rate.
- Buffer.
- Dropped frames.
- Decode errors.
- Missing files.
- Output errors.
- Log path.
- Export diagnostics bundle with secrets redacted.

## 9. Platform differences

### Windows

- WASAPI / shared mode.
- Exclusive mode if supported.
- Device change events.
- Long paths.
- Drive letters can change.

### macOS

- CoreAudio.
- Device change events.
- App sandbox permissions.
- SMB network volumes.
- Security-scoped bookmarks where needed.

Do not assume feature parity without testing both platforms.

## 10. Acceptance tests

- Play a real file.
- Pause and resume.
- Switch presentation without restart.
- Disconnect output device.
- Change sample rate.
- Use keyboard only.
- Use screen reader.
- Enable reduced motion.
- Enable high contrast.
- Resize to narrow width.
- Play a missing file.
- Play an unsupported file.
- Play a file with no analysis.
- Set and persist a cue.
- Set and persist a hot cue.
- Create and clear a loop.
- Save a playlist.
- Recover a draft.

## 11. Anti-patterns

- Silent normalization.
- Silent limiter.
- Fake audio device.
- Unlabeled icon buttons.
- Color-only cue states.
- Motion that cannot be disabled.
- Waveform-only information.
- Settings that require a restart without saying so.
- Player controls that are unreachable by keyboard.
