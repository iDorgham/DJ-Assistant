import { useEffect, useRef, type ReactNode } from "react";

/**
 * Accessible modal foundation (docs/ui/08): role="dialog", aria-modal, focus
 * moved in on open, Tab focus trapped inside, Escape closes, and focus
 * returns to the opener on close.
 */
interface ModalShellProps {
  onClose: () => void;
  ariaLabel: string;
  panelClassName?: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModalShell({ onClose, ariaLabel, panelClassName, children }: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
      if (focusables.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Lock background scroll while the dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-[#161616]/70 backdrop-blur-[1px] z-30 flex items-center justify-center p-6"
      onClick={(event) => {
        // Clicking the scrim (not the panel) dismisses, matching docs/ui/08.
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={
          panelClassName ??
          "max-w-full max-h-full overflow-y-auto bg-dj-panel border border-dj-border-strong shadow-2xl"
        }
      >
        {children}
      </div>
    </div>
  );
}
