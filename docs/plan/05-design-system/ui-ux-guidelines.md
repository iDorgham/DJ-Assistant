# UI/UX Guidelines

Last updated: 2026-10-23  
Status: Locked for v1. Implementation details may be refined without changing these rules. `docs/ui/01-DESIGN-SYSTEM.md` remains authoritative for the shipped token set and components.

## 1. Design intent

DJ Assistant should feel like a professional music tool:

- Dense but calm.
- Fast to scan.
- Dark-first, but with a proper light theme.
- Real data, clearly labeled.
- No decorative dashboards.
- No fake precision.

## 2. Layout

- Left navigation.
- Top bar with search, Import Center, Inbox and backup status.
- Main workspace.
- Bottom player dock.
- Optional right-side Track panel.
- Optional playlist pane in Player view.

Spacing scale:

```text
4, 8, 12, 16, 24, 32, 48
```

Rules:

- Align to a consistent grid.
- Keep table rows compact.
- Do not mix card and table layouts in the same view without a reason.
- The player dock has a stable height per presentation.
- The main workspace scrolls independently.

## 3. Typography

- One UI family.
- One numeric/tabular family for BPM, time, key and counts.
- Tabular numerals for tables and timers.
- Clear hierarchy:

```text
Display
Page title
Section title
Body
Label
Caption
```

Rules:

- Do not use all caps for long labels.
- Use sentence case.
- Truncate with ellipsis, but provide a tooltip or detail view.
- Do not shrink text below the accessibility minimum.
- Use tabular numbers for changing values.

## 4. Color

Semantic tokens:

```text
surface
surface-raised
surface-sunken
border
text
text-muted
text-inverse
accent
success
warning
danger
info
focus
```

Rules:

- Do not use color alone to communicate state.
- Status chips have text and icon.
- Charts use a perceptually ordered palette.
- Dark and light themes meet contrast requirements.
- Cue colors are user-selectable and never the only identifier.
- Destructive actions are visually distinct but not alarming.

## 5. Components

### Buttons

- Primary.
- Secondary.
- Ghost.
- Destructive.
- Icon button with accessible name.
- Loading state.
- Disabled state with reason.

### Inputs

- Persistent labels.
- Helper text.
- Error text.
- Required indicator.
- Autocomplete where relevant.
- No placeholder-only labels.

### Tables

- Sortable headers.
- Sticky header.
- Column resizing.
- Column visibility.
- Row selection.
- Bulk action bar.
- Empty state.
- Loading skeleton.
- Virtualized rows for large libraries.

### Tabs

- Use tabs for sibling views inside a workspace.
- Do not use tabs for unrelated navigation.
- Keep tab state.
- Tabs are keyboard navigable.

### Dialogs

- Clear title.
- Consequence summary.
- Primary and secondary actions.
- Destructive action requires confirmation.
- Focus trap and restore.
- Escape closes unless destructive.

### Toasts

- Short.
- Non-blocking.
- Not the only place an error appears.
- Action link where useful.
- Auto-dismiss only for informational messages.

### Chips

- Status chips.
- Tag chips.
- Filter chips.
- Removable where appropriate.
- Never color-only.

## 6. States

Every component defines:

- Default.
- Hover.
- Focus.
- Active.
- Selected.
- Disabled.
- Loading.
- Error.
- Empty.
- Partial.

Do not ship only the happy path.

## 7. Data display

- Show units.
- Show counts behind percentages.
- Do not use 3D.
- Do not use pie charts with many slices.
- Provide table alternatives.
- Label axes.
- Use consistent key notation.
- Show missing data explicitly.
- Do not fill missing values with zero.

## 8. Motion

- Fast, purposeful.
- Respect reduced motion.
- No decorative looping animation.
- No parallax.
- No flashing.
- Playhead motion is functional.
- Use motion to explain state changes, not to decorate.

## 9. Accessibility

- WCAG 2.2 AA.
- Keyboard reachable.
- Visible focus.
- Screen-reader labels.
- Target size.
- Contrast.
- Reduced motion.
- High contrast.
- Text alternatives for waveform and charts.
- No color-only meaning.
- Error messages tied to fields.

## 10. Performance and perceived speed

- Show the library immediately.
- Load counts and charts progressively.
- Virtualize long lists.
- Use skeletons for structure, not fake data.
- Optimistic UI only for reversible actions.
- Show progress for long jobs.
- Allow cancel and pause.
- Never block the UI on analysis, enrichment or backup.

## 11. Destructive actions

Destructive actions include:

- Purge.
- Delete playlist.
- Remove from library.
- Format USB.
- Replace library.
- Prune backups.
- Disconnect a backup target.

Requirements:

- Explain what will happen.
- Show scope.
- Require confirmation.
- Typed confirmation for irreversible actions.
- Offer a safer alternative.
- Record in History.

## 12. Copy and labels

- Use the shared vocabulary.
- Be specific.
- Say what happened and what to do next.
- Avoid “Oops”, “Something went wrong” alone.
- Avoid jargon unless the user knows it.
- Use “Quarantine”, not “Delete”, when the action is reversible.
- Use “Permanent purge” only for irreversible deletion.

## 13. Anti-patterns

- Dashboard-first layout.
- Fake data.
- Hidden errors.
- Silent overwrite.
- Unlabeled icons.
- Color-only status.
- Modal overload.
- Infinite spinners without progress.
- Auto-dismissing critical errors.
- Tiny hit targets.
- Low-contrast text.
- Decorative charts.
- Settings hidden behind mystery icons.
