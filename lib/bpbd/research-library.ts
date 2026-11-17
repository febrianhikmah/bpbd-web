import type { Store } from './model.ts';

export type LibraryVersion = { id: string; at: string; filename: string; summary: string; number: number };
export type LibraryResearch = { id: string; title: string; author: string; institution: string; versions: LibraryVersion[] };

// A separate projection shares result documents without exposing applications,
// contact details, supporting letters, datasets, or internal feedback.
export function researchLibrary(store: Store, availableFiles: Set<string>): LibraryResearch[] {
  return store.research.flatMap(r => {
    const versions = r.versions.flatMap((v, i) => availableFiles.has(v.fileId)
      ? [{ id: v.id, at: v.at, filename: v.filename, summary: v.summary, number: i + 1 }] : []).reverse();
    return versions.length ? [{ id: r.id, title: r.title, author: store.users.find(u => u.id === r.owner)?.name || 'Peneliti', institution: r.institution, versions }] : [];
  }).sort((a, b) => b.versions[0].at.localeCompare(a.versions[0].at) || a.id.localeCompare(b.id));
}
