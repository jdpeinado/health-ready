import type { EntryInput, GroupType } from "@health-ready/shared";
import type { EntryDetail } from "../../api/types";
import type { DraftEntry } from "./EntryEditor";
import { toEntryInput } from "./EntryEditor";

// A workout is edited as an ordered list of blocks: either a standalone exercise
// or a group (bi/tri-series) holding 2+ exercises. `id` is a client-only React key;
// `groupId` is the id persisted on every entry of the group.
export type Block =
  | { kind: "single"; id: string; entry: DraftEntry }
  | { kind: "group"; id: string; groupId: string; groupType: GroupType; entries: DraftEntry[] };

// Flatten blocks to ordered EntryInput[]. Each group's entries share its groupId +
// groupType. Empty groups are dropped; a group that ended up with <2 entries is
// degraded to standalone entries (the API rejects 1-entry groups).
export function blocksToEntries(blocks: Block[]): EntryInput[] {
  const out: EntryInput[] = [];
  for (const b of blocks) {
    if (b.kind === "single") {
      out.push({ ...toEntryInput(b.entry), groupId: null, groupType: null });
      continue;
    }
    if (b.entries.length === 0) continue;
    if (b.entries.length < 2) {
      for (const e of b.entries) {
        out.push({ ...toEntryInput(e), groupId: null, groupType: null });
      }
      continue;
    }
    for (const e of b.entries) {
      out.push({ ...toEntryInput(e), groupId: b.groupId, groupType: b.groupType });
    }
  }
  return out;
}

// Rebuild blocks from saved entries (already ordered). Consecutive entries sharing
// a groupId collapse into one group block; everything else is a single.
export function entriesToBlocks(
  entries: EntryDetail[],
  toDraft: (e: EntryDetail) => DraftEntry,
): Block[] {
  const blocks: Block[] = [];
  for (const e of entries) {
    const entry = toDraft(e);
    if (e.groupId == null) {
      blocks.push({ kind: "single", id: e.id, entry });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last && last.kind === "group" && last.groupId === e.groupId) {
      last.entries.push(entry);
    } else {
      blocks.push({
        kind: "group",
        id: e.groupId,
        groupId: e.groupId,
        groupType: e.groupType ?? "biserie",
        entries: [entry],
      });
    }
  }
  return blocks;
}
