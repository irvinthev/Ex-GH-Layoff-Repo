import type { CandidateProfile, ReviewerEvidenceRecord } from "./types.ts";

export const REVIEWER_EVIDENCE_TYPES = ["capability", "title"] as const;
export const REVIEWER_EVIDENCE_STATUSES = ["validated", "rejected"] as const;
export const REVIEWER_SOURCE_TYPES = ["linkedin", "resume", "portfolio", "direct_knowledge", "other"] as const;

const COLUMNS = "id,candidate_id,evidence_type,value,status,source_type,source_url,note,reviewed_by,reviewed_at,active";

// Minimal structural type so the module can be exercised without a live client.
// deno-lint-ignore no-explicit-any
type AdminClient = { from: (table: string) => any };

export type ReviewerEvidenceInput = {
  candidateId: string;
  evidenceType: ReviewerEvidenceRecord["evidence_type"];
  value: string;
  status: ReviewerEvidenceRecord["status"];
  sourceType: ReviewerEvidenceRecord["source_type"];
  sourceUrl: string | null;
  note: string | null;
};

export type ReviewerEvidenceResult = { status: number; body: Record<string, unknown> };

export function parseReviewerEvidenceInput(payload: Record<string, unknown> | null):
  { ok: true; input: ReviewerEvidenceInput } | { ok: false; error: string } {
  const candidateId = String(payload?.candidateId ?? "").trim().slice(0, 300);
  const value = String(payload?.value ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const evidenceType = String(payload?.evidenceType ?? "").trim();
  const status = String(payload?.status ?? "").trim();
  const sourceType = String(payload?.sourceType ?? "").trim();
  const rawUrl = String(payload?.sourceUrl ?? "").trim().slice(0, 2048);
  const note = String(payload?.note ?? "").trim().slice(0, 2000);

  if (!candidateId || !value) return { ok: false, error: "candidateId and value are required" };
  if (!(REVIEWER_EVIDENCE_TYPES as readonly string[]).includes(evidenceType)) {
    return { ok: false, error: "evidenceType must be capability or title" };
  }
  if (!(REVIEWER_EVIDENCE_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "status must be validated or rejected" };
  }
  if (!(REVIEWER_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    return { ok: false, error: "sourceType is not supported" };
  }
  let sourceUrl: string | null = null;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
      sourceUrl = parsed.toString();
    } catch {
      return { ok: false, error: "sourceUrl must be a valid http(s) URL" };
    }
  }
  return {
    ok: true,
    input: {
      candidateId,
      evidenceType: evidenceType as ReviewerEvidenceInput["evidenceType"],
      value,
      status: status as ReviewerEvidenceInput["status"],
      sourceType: sourceType as ReviewerEvidenceInput["sourceType"],
      sourceUrl,
      note: note || null,
    },
  };
}

export async function isAuthorizedReviewer(admin: AdminClient, email: string): Promise<boolean> {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  const { data, error } = await admin
    .from("admin_allowlist")
    .select("email")
    .eq("email", normalized)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/**
 * Saves reviewer evidence append-only. A newer decision for the same
 * candidate/type/value deactivates (never edits or deletes) the prior record.
 */
export async function saveReviewerEvidence(
  admin: AdminClient,
  reviewerEmail: string,
  payload: Record<string, unknown> | null,
): Promise<ReviewerEvidenceResult> {
  if (!(await isAuthorizedReviewer(admin, reviewerEmail))) {
    return { status: 403, body: { error: "This account is not authorized to save reviewer evidence" } };
  }
  const parsed = parseReviewerEvidenceInput(payload);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const { input } = parsed;

  const { data: activeRows, error: activeError } = await admin
    .from("placement_reviewer_evidence")
    .select("id,value")
    .eq("candidate_id", input.candidateId)
    .eq("evidence_type", input.evidenceType)
    .eq("active", true);
  if (activeError) throw activeError;
  const priorIds = ((activeRows ?? []) as Array<{ id: string; value: string }>)
    .filter((row) => row.value.trim().toLowerCase() === input.value.toLowerCase())
    .map((row) => row.id);

  if (priorIds.length) {
    const { error: deactivateError } = await admin
      .from("placement_reviewer_evidence")
      .update({ active: false })
      .in("id", priorIds);
    if (deactivateError) throw deactivateError;
  }

  const { data: inserted, error: insertError } = await admin
    .from("placement_reviewer_evidence")
    .insert({
      candidate_id: input.candidateId,
      evidence_type: input.evidenceType,
      value: input.value,
      status: input.status,
      source_type: input.sourceType,
      source_url: input.sourceUrl,
      note: input.note,
      reviewed_by: String(reviewerEmail).trim().toLowerCase(),
      reviewed_at: new Date().toISOString(),
      active: true,
    })
    .select(COLUMNS)
    .single();
  if (insertError) {
    if (priorIds.length) {
      await admin.from("placement_reviewer_evidence").update({ active: true }).in("id", priorIds);
    }
    throw insertError;
  }
  return { status: 200, body: { row: inserted } };
}

export async function getActiveReviewerEvidence(
  admin: AdminClient,
  candidateIds: string[],
): Promise<Map<string, ReviewerEvidenceRecord[]>> {
  const byCandidate = new Map<string, ReviewerEvidenceRecord[]>();
  const ids = [...new Set(candidateIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin
      .from("placement_reviewer_evidence")
      .select(COLUMNS)
      .eq("active", true)
      .in("candidate_id", ids.slice(i, i + 200))
      .order("reviewed_at", { ascending: false });
    if (error) throw error;
    for (const row of (data ?? []) as ReviewerEvidenceRecord[]) {
      const list = byCandidate.get(row.candidate_id) ?? [];
      list.push(row);
      byCandidate.set(row.candidate_id, list);
    }
  }
  return byCandidate;
}

export function withReviewerEvidence(
  candidate: CandidateProfile,
  records: ReviewerEvidenceRecord[] | undefined,
): CandidateProfile {
  return records?.length ? { ...candidate, reviewerEvidence: records } : candidate;
}
