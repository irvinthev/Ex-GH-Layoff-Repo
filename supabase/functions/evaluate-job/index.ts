import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import {
  classifyRole,
  getCandidateCache,
  getNetworkReview,
  inferSeniority,
  prepareJobProfile,
  scoreCandidate,
} from "./candidate-cache.ts";
import { attachEvidenceLayers } from "./evidence-layers.ts";
import { importJobFromUrl } from "./job-import.ts";

const ALLOWED_ORIGINS = new Set([
  "https://irvinthev.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://irvinthev.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-beta-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function getDefaultKey(currentName: string, legacyName: string): string {
  const current = Deno.env.get(currentName);
  if (current) {
    try {
      const keys = JSON.parse(current) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      console.error(`Could not parse ${currentName}`);
    }
  }
  return Deno.env.get(legacyName) ?? "";
}

function humanizeLevel(value: string | null): string {
  const map: Record<string, string> = {
    intern: "internship-level",
    entry: "entry-level",
    junior: "junior-level",
    associate: "associate-level",
    mid: "mid-level",
    senior: "senior-level",
    lead: "lead-level",
    staff: "staff-level",
    principal: "principal-level",
    manager: "manager-level",
    director: "director-level",
    executive: "executive-level",
    vp: "VP-level",
  };
  return value ? (map[value] ?? value) : "";
}

function parseJobTitleContext(rawTitle: string): { company: string | null; roleTitle: string } {
  const normalized = rawTitle
    .replace(/\s+\|\s+LinkedIn\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const linkedIn = normalized.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+.+$/i);
  if (linkedIn) {
    return { company: linkedIn[1].trim(), roleTitle: linkedIn[2].trim() };
  }
  return { company: null, roleTitle: normalized || "this role" };
}

function buildJobBrief(job: ReturnType<typeof prepareJobProfile>, role: ReturnType<typeof classifyRole>, rawTitle: string) {
  const { company, roleTitle } = parseJobTitleContext(rawTitle);
  const subject = company ? `${company} is looking for` : "The company is looking for";
  const roleFamily = role?.role_family ? ` in the ${role.role_family} family` : "";
  const sentence1 = `${subject} a ${roleTitle}${roleFamily}.`;

  const technical = [...new Set(job.technicalRequirementTerms)].slice(0, 5);
  const concepts = [...new Set(job.concepts)]
    .filter((label) => label !== "Data analysis and BI" || !technical.some((term) => ["sql","tableau","power bi","python"].includes(term)))
    .slice(0, 3);
  const focusParts: string[] = [];
  if (technical.length) focusParts.push(`technical signals such as ${technical.join(", ")}`);
  if (concepts.length) focusParts.push(`broader focus on ${concepts.join(", ")}`);
  const sentence2 = focusParts.length
    ? `The posting emphasizes ${focusParts.join(", with ")}.`
    : "The posting emphasizes the responsibilities and capabilities described in the job description.";

  const level = humanizeLevel(job.seniority);
  const workModel = job.remoteType ? job.remoteType.toLowerCase() : "";
  const context = [level, workModel].filter(Boolean).join(", ");
  const sentence3 = context
    ? `It is positioned as a ${context} role, so direct evidence against those requirements should carry the most weight.`
    : "Direct evidence against the job requirements should carry the most weight when comparing candidates.";

  return {
    company,
    roleTitle,
    narrative: [sentence1, sentence2, sentence3].join(" "),
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const evaluationStartedAt = performance.now();
  let authorizedAdmin = false;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwtToken = authHeader.replace(/^Bearer\s+/i, "");
    const betaToken = String(req.headers.get("x-beta-token") ?? "").trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = getDefaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const serviceRoleKey = getDefaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) throw new Error("Function environment is incomplete");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let email = "";
    let actorUserId: string | null = null;

    if (betaToken) {
      const tokenHash = await sha256Hex(betaToken);
      const { data: betaSession, error: betaError } = await admin
        .from("beta_sessions")
        .select("email,expires_at")
        .eq("token_hash", tokenHash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (betaError) throw betaError;
      if (!betaSession) return json(req, { error: "Beta session expired. Sign in again." }, 401);
      email = String(betaSession.email ?? "").trim().toLowerCase();
    } else {
      if (!jwtToken) return json(req, { error: "Authentication required" }, 401);
      const authClient = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData, error: authError } = await authClient.auth.getUser(jwtToken);
      email = String(authData.user?.email ?? "").trim().toLowerCase();
      actorUserId = authData.user?.id ?? null;
      if (authError || !authData.user || !email) return json(req, { error: "Invalid session" }, 401);
    }

    const { data: allowlistEntry, error: allowlistError } = await admin
      .from("admin_allowlist")
      .select("email")
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();
    if (allowlistError) throw allowlistError;
    if (!allowlistEntry) return json(req, { error: "This account is not authorized for Placement Intelligence" }, 403);
    authorizedAdmin = true;

    const payload = await req.json().catch(() => null) as Record<string, unknown> | null;
    const action = String(payload?.action ?? "evaluate");

    if (action === "network_review") {
      const review = await getNetworkReview(admin);
      return json(req, review);
    }

    if (action === "history") {
      let historyQuery = admin
        .from("job_evaluation_runs")
        .select("id,title,source_url,location_text,remote_type,source_mode,methodology,role_snapshot,seniority,candidate_count,created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      historyQuery = actorUserId
        ? historyQuery.eq("actor_user_id", actorUserId)
        : historyQuery.eq("actor_email", email);
      const { data: runs, error: historyError } = await historyQuery;
      if (historyError) throw historyError;
      return json(req, { runs: runs ?? [] });
    }

    if (action === "history_detail") {
      const runId = String(payload?.runId ?? "").trim();
      if (!runId) return json(req, { error: "Run ID is required" }, 400);
      let runQuery = admin
        .from("job_evaluation_runs")
        .select("id,result_snapshot,created_at")
        .eq("id", runId);
      runQuery = actorUserId
        ? runQuery.eq("actor_user_id", actorUserId)
        : runQuery.eq("actor_email", email);
      const { data: run, error: runError } = await runQuery.maybeSingle();
      if (runError) throw runError;
      if (!run) return json(req, { error: "Evaluation run not found" }, 404);
      return json(req, { runId: run.id, createdAt: run.created_at, ...run.result_snapshot });
    }

    if (action === "calibration_history") {
      const { data: rows, error: calibrationError } = await admin
        .from("placement_calibration_feedback")
        .select("id,candidate_id,company,job_title,job_url,engine_version,predicted_score,fit_band,score_breakdown,recommendation_status,outcome_strength,candidate_feedback,calibration_label,observed_at,metadata,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (calibrationError) throw calibrationError;
      return json(req, { rows: rows ?? [] });
    }

    if (action === "record_feedback") {
      const candidateId = String(payload?.candidateId ?? "").trim();
      const company = String(payload?.company ?? "").trim().slice(0, 300);
      const jobTitle = String(payload?.jobTitle ?? "").trim().slice(0, 300);
      const outcome = String(payload?.outcome ?? "").trim();
      const feedback = String(payload?.candidateFeedback ?? "").trim().slice(0, 4000);
      const observedAt = String(payload?.observedAt ?? "").trim() || new Date().toISOString();
      const allowedOutcomes = new Set([
        "recommended", "viewed", "interested", "applied", "recruiter_screen",
        "hiring_manager_interview", "final_round", "offer", "accepted", "pass",
        "rejected", "already_applied", "already_seen", "location_mismatch",
        "wrong_level", "wrong_role", "not_interested", "pending_feedback",
      ]);
      if (!candidateId || !company || !jobTitle || !allowedOutcomes.has(outcome)) {
        return json(req, { error: "candidateId, company, jobTitle, and a valid outcome are required" }, 400);
      }
      const outcomeStrength: Record<string, number | null> = {
        recommended: null,
        pending_feedback: null,
        viewed: 20,
        interested: 40,
        applied: 60,
        recruiter_screen: 65,
        hiring_manager_interview: 70,
        final_round: 80,
        offer: 90,
        accepted: 100,
        already_applied: 55,
        already_seen: 20,
        pass: 0,
        rejected: 0,
        location_mismatch: 0,
        wrong_level: 0,
        wrong_role: 0,
        not_interested: 0,
      };
      const label = ["applied","recruiter_screen","hiring_manager_interview","final_round","offer","accepted"].includes(outcome)
        ? "strong_positive"
        : outcome === "interested" || outcome === "already_applied"
          ? "positive"
          : ["pass","rejected","location_mismatch","wrong_level","wrong_role","not_interested"].includes(outcome)
            ? "negative"
            : outcome === "pending_feedback"
              ? "pending"
              : "neutral";

      const { data: existing, error: existingError } = await admin
        .from("placement_calibration_feedback")
        .select("id")
        .eq("candidate_id", candidateId)
        .ilike("company", company)
        .ilike("job_title", jobTitle)
        .maybeSingle();
      if (existingError) throw existingError;

      const updatePayload = {
        recommendation_status: outcome,
        outcome_strength: outcomeStrength[outcome],
        candidate_feedback: feedback || null,
        calibration_label: label,
        observed_at: observedAt,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        const { data: updated, error: updateError } = await admin
          .from("placement_calibration_feedback")
          .update(updatePayload)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (updateError) throw updateError;
        return json(req, { row: updated });
      }

      const { data: inserted, error: insertError } = await admin
        .from("placement_calibration_feedback")
        .insert({
          candidate_id: candidateId,
          company,
          job_title: jobTitle,
          recommendation_status: outcome,
          outcome_strength: outcomeStrength[outcome],
          candidate_feedback: feedback || null,
          calibration_label: label,
          observed_at: observedAt,
          metadata: { source: "admin_recorded_feedback" },
        })
        .select("*")
        .single();
      if (insertError) throw insertError;
      return json(req, { row: inserted });
    }

    let title = String(payload?.title ?? "").trim().slice(0, 300);
    let description = String(payload?.description ?? "").trim().slice(0, 50000);
    let location = String(payload?.location ?? "").trim().slice(0, 300);
    let remoteType = String(payload?.remoteType ?? "").trim().slice(0, 100);
    const jobUrl = String(payload?.jobUrl ?? "").trim().slice(0, 2048);
    let sourceUrl: string | null = null;
    let sourceMode: "structured" | "page_text" | "pasted" | "url_plus_paste" = "pasted";
    let importWarning: string | null = null;

    if (jobUrl) {
      try {
        const imported = await importJobFromUrl(jobUrl);
        sourceUrl = imported.canonicalUrl;
        sourceMode = description.length >= 50 ? "url_plus_paste" : imported.sourceMode;
        title ||= imported.title;
        description ||= imported.description;
        location ||= imported.location;
        remoteType ||= imported.remoteType;
      } catch (importError) {
        if (description.length < 50) {
          const detail = importError instanceof Error ? importError.message : "The job page could not be read";
          return json(req, {
            error: `${detail}. Paste the job description below and try again.`,
            code: "JOB_URL_UNREADABLE",
          }, 422);
        }
        importWarning = "The job page could not be read, so the pasted description was used.";
      }
    }

    if (description.length < 50) {
      return json(req, { error: "Add a public job URL or paste at least 50 characters of the job description" }, 400);
    }

    const { cache, metrics: cacheMetrics } = await getCandidateCache(admin);
    const job = prepareJobProfile({ title, description, location, remoteType });
    const role = classifyRole(job, cache.roles);
    const scoringStartedAt = performance.now();
    const scoredMatches = cache.candidates
      .map((candidate) => scoreCandidate(candidate, role, job));

    // Evidence depth is derived from the same canonical merged candidate
    // profiles used for scoring. Missing L3 remains metadata only and never
    // reduces fit or rank.
    const matches = attachEvidenceLayers(scoredMatches, cache.candidates, {
      requiresTechnicalSkillEvidence: job.requiresTechnicalSkillEvidence,
    })
      .sort((a, b) => b.score - a.score);
    const scoringMs = roundMs(performance.now() - scoringStartedAt);

    const evidenceSummary = matches.reduce((summary, match) => {
      summary[match.evidenceConfidence.confidence.toLowerCase() as "high" | "medium" | "low"] += 1;
      return summary;
    }, { high: 0, medium: 0, low: 0 });

    const jobBrief = buildJobBrief(job, role, title || "Untitled role");
    const evaluation = {
      title: title || "Untitled role",
      role: role ? { slug: role.slug, functionName: role.function_name, roleFamily: role.role_family, specialty: role.specialty } : null,
      jobBrief,
      requirementsParsed: job.requirementsParsed,
      seniority: inferSeniority(title, description),
      location: location || null,
      remoteType: remoteType || null,
      candidateCount: matches.length,
      evidenceSummary,
      evaluatedAt: new Date().toISOString(),
      methodology: "Evidence-aware deterministic scoring v20; one canonical merged candidate profile drives both scoring and evidence reporting; held-title specialty and role-family evidence are independent, and title-derived concepts cannot create role-family credit; higher role-family credit requires exact role evidence or corroborated evidence across multiple distinct core JD capabilities, while function alignment remains a lower-strength signal; qualification points use distinct recognized JD capability units resolved from public narrative, public skills and approved enriched evidence; evidence provenance is retained for matched capabilities; profile depth is metadata only and never increases score or rank; explicit preferred sections and company/benefits sections do not supply core points; seniority and location remain validation signals; manual review required",
      sourceUrl,
      sourceMode,
      importWarning,
    };

    const snapshot = { evaluation, matches };
    const totalDurationMs = roundMs(performance.now() - evaluationStartedAt);

    EdgeRuntime.waitUntil((async () => {
      const writes = [
        admin
          .from("job_evaluation_runs")
          .insert({
            actor_user_id: actorUserId,
            actor_email: email,
            title: evaluation.title,
            source_url: sourceUrl,
            location_text: evaluation.location,
            remote_type: evaluation.remoteType,
            source_mode: evaluation.sourceMode,
            methodology: evaluation.methodology,
            role_snapshot: evaluation.role,
            seniority: evaluation.seniority,
            candidate_count: evaluation.candidateCount,
            result_snapshot: snapshot,
          })
          .then(({ error }) => {
            if (error) console.error("Could not save evaluation history", error);
          }),
        actorUserId
          ? admin
              .from("evaluation_metrics")
              .insert({
                actor_user_id: actorUserId,
                title: evaluation.title,
                source_url: sourceUrl,
                source_mode: evaluation.sourceMode,
                role_slug: evaluation.role?.slug ?? null,
                cache_status: cacheMetrics.cacheStatus,
                cache_load_ms: cacheMetrics.loadMs,
                database_query_ms: cacheMetrics.databaseQueryMs,
                scoring_ms: scoringMs,
                total_duration_ms: totalDurationMs,
                candidate_count: evaluation.candidateCount,
                cached_candidate_count: cacheMetrics.candidateCount,
                cache_loaded_at: cacheMetrics.loadedAt,
              })
              .then(({ error }) => {
                if (error) console.error("Could not save evaluation metrics", error);
              })
          : Promise.resolve(),
      ];
      await Promise.allSettled(writes);
    })());

    return json(req, snapshot);
  } catch (error) {
    console.error("evaluate-job failed", error);
    const detail = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : String(error);
    return json(req, {
      error: authorizedAdmin
        ? `Evaluation failed: ${detail}`
        : "The evaluation could not be completed",
    }, 500);
  }
});
