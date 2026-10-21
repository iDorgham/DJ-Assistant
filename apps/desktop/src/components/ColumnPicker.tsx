import { useState } from "react";
import { Columns3, GripVertical, RotateCcw, X } from "lucide-react";

import { canHideColumn, columnDefinition } from "../lib/library-columns";
import type { ColumnId, ColumnState } from "../lib/library-columns";

/**
 * Column checklist for the Library table (T2.1.5, docs/ui/03 §3.2).
 *
 * It only ever edits the column list through the pure helpers in
 * `lib/library-columns` — the invariant that a table keeps at least one identity
 * column lives there, so this component asks `canHideColumn` instead of
 * re-implementing the rule.
 */
interface ColumnPickerProps {
  columns: ColumnState[];
  onToggle: (id: ColumnId) => void;
  onMove: (draggedId: ColumnId, targetId: ColumnId) => void;
  onReset: () => void;
  onClose: () => void;
  /** Anchor classes; the panel assumes the parent is `relative`. */
  className?: string;
}

export function ColumnPicker({
  columns,
  onToggle,
  onMove,
  onReset,
  onClose,
  className = "absolute right-5 top-11 z-40",
}: ColumnPickerProps) {
  const [draggedId, setDraggedId] = useState<ColumnId | null>(null);
  const visibleCount = columns.filter((column) => column.visible).length;

  return (
    <div
      role="dialog"
      aria-label="Columns"
      className={`flex max-h-[calc(100%-3.5rem)] w-[280px] flex-col overflow-hidden rounded-lg border border-dj-border bg-dj-panel shadow-2xl shadow-black/60 ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-dj-border px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-dj-text">
          <Columns3 className="h-3.5 w-3.5 text-dj-accent" />
          <span>Columns</span>
          <span className="font-mono text-[11px] font-normal text-dj-text-muted">
            {visibleCount}/{columns.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm p-1 text-dj-text-muted transition hover:bg-dj-elevated hover:text-dj-text"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {columns.map((column) => {
          const definition = columnDefinition(column.id);
          const pinned = column.visible && !canHideColumn(columns, column.id);
          return (
            <li
              key={column.id}
              draggable
              onDragStart={() => setDraggedId(column.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => {
                if (draggedId && draggedId !== column.id) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedId) onMove(draggedId, column.id);
                setDraggedId(null);
              }}
              className={`group flex items-center gap-2 px-3 py-1 text-xs transition ${
                draggedId === column.id ? "bg-dj-active" : "hover:bg-dj-hover"
              }`}
              title={
                pinned
                  ? "Keep at least one Title or Artist column to identify each row"
                  : `Drag to reorder · ${definition.label}`
              }
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-dj-text-muted opacity-40 group-hover:opacity-100" />
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={column.visible}
                  disabled={pinned}
                  onChange={() => onToggle(column.id)}
                  className="accent-dj-accent"
                />
                <span
                  className={`min-w-0 truncate ${
                    column.visible ? "text-dj-text" : "text-dj-text-muted"
                  }`}
                >
                  {definition.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex shrink-0 items-center justify-between border-t border-dj-border px-3 py-2">
        <p className="text-[11px] text-dj-text-muted">Drag a row to reorder.</p>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-md border border-dj-border bg-dj-elevated px-2 py-1 text-[11px] text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
          title="Restore the documented defaults"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>
    </div>
  );
}
