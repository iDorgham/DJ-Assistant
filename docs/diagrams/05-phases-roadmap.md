# 90-Day Phases Roadmap

```mermaid
gantt
    title DJ Assistant — 90-Day MVP Roadmap
    dateFormat  YYYY-MM-DD
    axisFormat  %d %b

    section Phase 0
    Foundation — Shell, Scan, SQLite           :p0, 2026-10-08, 15d

    section Phase 1
    Analysis Engine — ONNX, BPM, Key, Phrases  :p1, 2026-10-23, 20d

    section Phase 2
    Library + Tag Cleanup + Cue Master         :p2, 2026-11-07, 25d

    section Phase 3
    Set Builder + Beam Search + Export         :p3, 2026-11-17, 30d

    section Phase 4
    Skills, Gig Ready, Polish, Closed Beta     :p4, 2026-12-07, 30d

    section Milestones
    Weekly internal builds start               :milestone, m1, 2026-10-23, 0d
    Closed beta invites                        :milestone, m2, 2026-12-07, 0d
    MVP acceptance gate                        :milestone, m3, 2026-01-06, 0d
```

## Phase Overlap View

```mermaid
timeline
    title Phase Overlap (Conceptual)
    section Days 1-15
        Phase 0 Foundation
    section Days 16-35
        Phase 1 Analysis Engine
    section Days 31-55
        Phase 2 Library & Tags
    section Days 41-70
        Phase 3 Set Builder & Export
    section Days 61-90
        Phase 4 Polish & Beta
```

## Exit Gates Summary

| Phase | Primary Exit Gate |
|-------|-------------------|
| 0 | Scan + list 50–100 tracks with stable hashes |
| 1 | 50 tracks analyzed < 5 min; p50 < 3s/track |
| 2 | Messy 1k library cleaned in one review pass |
| 3 | Coherent 90–120 min set + CDJ-validated export |
| 4 | 40-track prep < 15 min + MVP acceptance criteria |
