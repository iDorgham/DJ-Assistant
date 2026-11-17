/**
 * Selection updates for the mix-suggestions dock actions (T2.1.11).
 * Both helpers return the input array unchanged when nothing would move,
 * so callers can hand them straight to a state setter without churn.
 */

export function addSuggestionToSelection(selection: string[], candidateId: string): string[] {
  return selection.includes(candidateId) ? selection : [...selection, candidateId];
}

export function replaceSeedInSelection(
  selection: string[],
  seedId: string | null | undefined,
  candidateId: string
): string[] {
  const seedIndex = seedId == null ? -1 : selection.indexOf(seedId);
  if (seedIndex === -1) {
    return addSuggestionToSelection(selection, candidateId);
  }
  if (selection.includes(candidateId)) {
    return selection.filter((id) => id !== seedId);
  }
  const next = [...selection];
  next[seedIndex] = candidateId;
  return next;
}
