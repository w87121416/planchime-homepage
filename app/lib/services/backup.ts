import { integer, text, utc, versioned, PurchaseClientError } from "../purchase/protocol.ts";
import { parseDocument, type PlannerDocument } from "../planner/model.ts";
import { accountResponse } from "./protocol.ts";

export type BackupVersion = Readonly<{ requestId: string; createdAt: string; byteLength: number; itemCount: number; downloadUntil: string; available: boolean }>;
export type BackupList = Readonly<{ capacityBytes: 100000000; usedBytes: number; canUpload: boolean; membershipValidUntil: string | null; versions: readonly BackupVersion[]; nextCursor: string | null }>;
export type DownloadedBackup = Readonly<{ metadata: BackupVersion; document: PlannerDocument }>;
export function backupVersion(value: unknown): BackupVersion {
  const row = versioned(value), byteLength = integer(row.byteLength), itemCount = integer(row.itemCount);
  if (byteLength > 2_000_000 || itemCount > 500 || typeof row.available !== "boolean") throw new PurchaseClientError("INVALID_RESPONSE");
  return Object.freeze({ requestId: text(row.requestId), createdAt: utc(row.createdAt), downloadUntil: utc(row.downloadUntil), byteLength, itemCount, available: row.available });
}
export function parseBackupList(value: unknown, accountId: string): BackupList {
  const response = accountResponse(value, accountId), row = response.backup;
  if (!row || typeof row !== "object") throw new PurchaseClientError("INVALID_RESPONSE");
  const b = row as Record<string, unknown>;
  if (b.capacityBytes !== 100_000_000 || typeof b.canUpload !== "boolean" || !Array.isArray(b.versions) || b.versions.length > 1000) throw new PurchaseClientError("INVALID_RESPONSE");
  const usedBytes = integer(b.usedBytes); if (usedBytes > b.capacityBytes) throw new PurchaseClientError("INVALID_RESPONSE");
  const versions = b.versions.map(backupVersion); if (new Set(versions.map(v => v.requestId)).size !== versions.length) throw new PurchaseClientError("INVALID_RESPONSE");
  return Object.freeze({ capacityBytes: 100_000_000, usedBytes, canUpload: b.canUpload, membershipValidUntil: b.membershipValidUntil === null ? null : utc(b.membershipValidUntil),
    versions: Object.freeze(versions), nextCursor: b.nextCursor === null ? null : text(b.nextCursor) });
}
export function parseDownloadedBackup(value: unknown, accountId: string, requestId: string): DownloadedBackup {
  const response = accountResponse(value, accountId), row = response.backup as Record<string, unknown>;
  if (!row || typeof row !== "object") throw new PurchaseClientError("INVALID_RESPONSE");
  const metadata = backupVersion(row.metadata), document = parseDocument(JSON.stringify(row.document));
  if (metadata.requestId !== requestId || !metadata.available || metadata.itemCount !== document.items.length ||
      metadata.byteLength !== new TextEncoder().encode(JSON.stringify(document)).byteLength) throw new PurchaseClientError("INVALID_RESPONSE");
  return Object.freeze({ metadata, document });
}
