import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, Trash2 } from "lucide-react";
import type { HotCueData } from "../../lib/waveform-generator";
import { formatTimecode } from "../../lib/waveform-generator";

interface HotCueStripProps {
  cues: HotCueData[];
  onTriggerCue: (slot: number) => void;
  onSetCue: (slot: number) => void;
  onClearCue: (slot: number) => void;
}

interface CueMenu {
  cue: HotCueData;
  left: number;
  top: number;
  openUp: boolean;
}

/**
 * Compact CDJ-style hot-cue pads: one 30px row in every presentation, a colour
 * bar across the top of a set pad, the slot letter and its timecode inline.
 * Click calls or sets a cue; right-click opens the Call / Delete menu; the
 * hover × is the visible clear affordance that pairs with the Undo toast.
 */
export function HotCueStrip({ cues, onTriggerCue, onSetCue, onClearCue }: HotCueStripProps) {
  const [menu, setMenu] = useState<CueMenu | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const callRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menu) return;
    callRef.current?.focus();
    const close = () => setMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const handleClick = (e: React.MouseEvent, cue: HotCueData) => {
    e.preventDefault();
    if (e.shiftKey) {
      if (cue.positionMs !== null) onClearCue(cue.slot);
      return;
    }
    if (cue.positionMs !== null) {
      onTriggerCue(cue.slot);
    } else {
      onSetCue(cue.slot);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>, cue: HotCueData) => {
    e.preventDefault();
    e.stopPropagation();
    if (cue.positionMs === null) return;

    triggerRef.current = e.currentTarget;
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, menuWidth / 2 + 8),
      window.innerWidth - menuWidth / 2 - 8
    );
    const openUp = rect.top > 120;
    setMenu({
      cue,
      left,
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      openUp,
    });
  };

  const closeMenu = () => setMenu(null);

  return (
    <>
      <div className="flex w-full items-stretch gap-1" role="toolbar" aria-label="Hot cue pads A–H">
        {cues.map((cue) => {
          const isSet = cue.positionMs !== null;
          return (
            <div key={cue.letter} className="group relative min-w-[38px] flex-1 max-w-[72px]">
              <button
                type="button"
                onClick={(e) => handleClick(e, cue)}
                onContextMenu={(e) => handleContextMenu(e, cue)}
                aria-label={
                  isSet
                    ? `Hot cue ${cue.letter}, ${formatTimecode(cue.positionMs!, true)}. Click to jump. Right-click for Call or Delete.`
                    : `Hot cue ${cue.letter}, empty. Click to set at the playhead.`
                }
                title={
                  isSet
                    ? `Hot cue ${cue.letter} (${formatTimecode(cue.positionMs!, true)}) — click to jump · right-click for Call / Delete · × clears (Key: ${cue.slot})`
                    : `Hot cue ${cue.letter} (Empty) — click to set at the current position (Key: ${cue.slot})`
                }
                className={`relative flex h-[30px] w-full min-w-0 select-none items-center justify-between gap-1 overflow-hidden rounded-[2px] border px-1.5 pt-[2px] transition-[filter,transform,border-color,background-color] duration-100 active:scale-[0.98] ${
                  isSet
                    ? "border-dj-border text-dj-text hover:brightness-110"
                    : "border-dashed border-dj-border bg-dj-bg/50 text-dj-text-muted hover:border-dj-border-strong hover:bg-dj-elevated/40"
                }`}
                style={
                  isSet
                    ? {
                        borderColor: cue.colorHex,
                        background: `linear-gradient(180deg, ${cue.colorHex}26 0%, ${cue.colorHex}0d 100%)`,
                      }
                    : undefined
                }
              >
                {isSet && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-[2px]"
                    style={{ backgroundColor: cue.colorHex }}
                  />
                )}
                <span
                  className="shrink-0 font-mono text-[11px] font-bold leading-none"
                  style={{ color: isSet ? cue.colorHex : undefined }}
                >
                  {cue.letter}
                </span>
                <span
                  className={`truncate font-mono text-[9px] leading-none tabular-nums ${
                    isSet ? "text-dj-text-secondary" : "text-dj-text-muted"
                  }`}
                >
                  {isSet ? formatTimecode(cue.positionMs!, false) : "—"}
                </span>
              </button>

              {isSet && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearCue(cue.slot);
                  }}
                  aria-label={`Clear hot cue ${cue.letter}`}
                  title={`Clear hot cue ${cue.letter} — Undo offered after clearing`}
                  className="absolute -right-1 -top-1 z-10 flex h-3.5 w-3.5 items-center justify-center border border-dj-border bg-dj-overlay text-[10px] leading-none text-dj-text-secondary opacity-0 pointer-events-none shadow-sm transition hover:border-dj-danger hover:text-dj-danger group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {menu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[80]"
              aria-hidden="true"
              onMouseDown={closeMenu}
              onContextMenu={(e) => {
                e.preventDefault();
                closeMenu();
              }}
            />
            <div
              role="menu"
              aria-label={`Hot cue ${menu.cue.letter} actions`}
              className="fixed z-[81] w-[176px] rounded-sm border border-dj-border bg-dj-overlay py-1 shadow-2xl"
              style={{
                left: `${menu.left}px`,
                top: `${menu.top}px`,
                transform: menu.openUp ? "translate(-50%, -100%)" : "translate(-50%, 0)",
              }}
            >
              <div className="flex items-center justify-between border-b border-dj-border px-2.5 pb-1.5 pt-0.5">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-dj-text-muted">
                  Hot cue {menu.cue.letter}
                </span>
                <span className="font-mono text-[9px] tabular-nums text-dj-text-muted">
                  {formatTimecode(menu.cue.positionMs!, true)}
                </span>
              </div>
              <button
                ref={callRef}
                type="button"
                role="menuitem"
                onClick={() => {
                  onTriggerCue(menu.cue.slot);
                  closeMenu();
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] text-dj-text transition hover:bg-dj-hover focus-visible:bg-dj-hover"
              >
                <Play className="h-3 w-3 text-dj-accent" aria-hidden="true" />
                Call hot cue
                <span className="ml-auto font-mono text-[9px] text-dj-text-muted">Enter</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onClearCue(menu.cue.slot);
                  closeMenu();
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] text-dj-danger transition hover:bg-dj-danger/10 focus-visible:bg-dj-danger/10"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                Delete hot cue
              </button>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
