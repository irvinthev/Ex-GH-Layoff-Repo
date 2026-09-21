import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import {
  classifyRole,
  getCandidateCache,
  inferSeniority,
  prepareJobProfile,
  scoreCandidate,
} from "./candidate-cache.ts";
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const evaluationStartedAt = performance.now();
  let authorizedAdmin = false;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(req, { error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = getDefaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const serviceRoleKey = getDefaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) throw new Error("Function environment is incomplete");

    const authClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const email = String(authData.user?.email ?? "").trim().toLowerCase();
    if (authError || !authData.user || !email) return json(req, { error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
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

    if (action === "history") {
      const { data: runs, error: historyError } = await admin
        .from("job_evaluation_runs")
        .select("id,title,source_url,location_text,remote_type,source_mode,methodology,role_snapshot,seniority,candidate_count,created_at")
        .eq("actor_user_id", authData.user.id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (historyError) throw historyError;
      return json(req, { runs: runs ?? [] });
    }

    if (action === "history_detail") {
      const runId = String(payload?.runId ?? "").trim();
      if (!runId) return json(req, { error: "Run ID is required" }, 400);
      const { data: run, error: runError } = await admin
        .from("job_evaluation_runs")
        .select("id,result_snapshot,created_at")
        .eq("id", runId)
        .eq("actor_user_id", authData.user.id)
        .maybeSingle();
      if (runError) throw runError;
      if (!run) return json(req, { error: "Evaluation run not found" }, 404);
      return json(req, { runId: run.id, createdAt: run.created_at, ...run.result_snapshot });
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
    const matches = cache.candidates
      .map((candidate) => scoreCandidate(candidate, role, job))
      .sort((a, b) => b.score - a.score);
    const scoringMs = roundMs(performance.now() - scoringStartedAt);

    const evaluation = {
      title: title || "Untitled role",
      role: role ? { slug: role.slug, functionName: role.function_name, roleFamily: role.role_family, specialty: role.specialty } : null,
      seniority: inferSeniority(title, description),
      location: location || null,
      remoteType: remoteType || null,
      candidateCount: matches.length,
      evaluatedAt: new Date().toISOString(),
      methodology: "Evidence-aware deterministic scoring v5; cached candidate profiles, pre-tokenized preferences, and manual review required",
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
            actor_user_id: authData.user.id,
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
        admin
          .from("evaluation_metrics")
          .insert({
            actor_user_id: authData.user.id,
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
          }),
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
