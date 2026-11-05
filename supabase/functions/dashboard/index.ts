import { verifyJwt } from '../_shared/auth.ts';
import { hasActiveRole } from '../_shared/rbac.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { error, handleError, json, preflight } from '../_shared/http.ts';

const DASHBOARD_ROLES = ['admin', 'operator', 'case_worker', 'reviewer', 'auditor'];
const PAGE_SIZE = 1000;
const TREND_WEEKS = 5;
const ACTIVITY_DAYS = 30;

async function fetchAll(makeQuery: (from: number, to: number) => Promise<any>) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error: queryError } = await makeQuery(offset, offset + PAGE_SIZE - 1);
    if (queryError) throw queryError;
    const page = (data ?? []) as any[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function weekStart(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date;
}

function weekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function activity(id: string, occurredAt: string, label: string, destination: string) {
  return { id, occurredAt, label, destination };
}

async function dashboardSummary(supabase: any, userId: string, systemScope: boolean) {
  const imports = await fetchAll((from, to) => {
    let query = supabase
      .from('imports')
      .select('id, status, uploaded_by, row_count, household_count, committed_at, created_at')
      .order('created_at', { ascending: false });
    if (!systemScope) query = query.eq('uploaded_by', userId);
    return query.range(from, to);
  });
  const committedImports = imports.filter((row) => row.status === 'committed');
  const committedIds = committedImports.map((row) => row.id);

  let granteeIssues = 0;
  for (let index = 0; index < committedIds.length; index += 100) {
    const ids = committedIds.slice(index, index + 100);
    const householdRows = await fetchAll((from, to) =>
      supabase
        .from('households')
        .select('grantee_status')
        .in('import_id', ids)
        .range(from, to),
    );
    granteeIssues += householdRows.filter((row) => row.grantee_status !== 'valid').length;
  }

  const allAssessments = await fetchAll((from, to) =>
    supabase
      .from('case_assessments')
      .select('id, case_group_id, status, revision, owner_id, reviewer_id, updated_at, created_at')
      .order('updated_at', { ascending: false })
      .range(from, to),
  );
  const assessments = systemScope
    ? allAssessments
    : allAssessments.filter(
        (row) => row.owner_id === userId || row.reviewer_id === userId,
      );
  const latestByCase = new Map<string, any>();
  for (const assessment of allAssessments) {
    const current = latestByCase.get(assessment.case_group_id);
    if (!current || Number(assessment.revision) > Number(current.revision)) {
      latestByCase.set(assessment.case_group_id, assessment);
    }
  }
  const pipeline = {
    draft: 0,
    submitted: 0,
    changes_requested: 0,
    approved: 0,
  };
  for (const assessment of latestByCase.values()) {
    if (!systemScope && assessment.owner_id !== userId && assessment.reviewer_id !== userId) {
      continue;
    }
    if (assessment.status in pipeline) pipeline[assessment.status as keyof typeof pipeline] += 1;
  }

  const assessmentIds = assessments.map((assessment) => assessment.id);
  const exportJobs: any[] = [];
  if (systemScope) {
    exportJobs.push(
      ...(await fetchAll((from, to) =>
        supabase
          .from('export_jobs')
          .select('id, assessment_id, state, created_at')
          .order('created_at', { ascending: false })
          .range(from, to),
      )),
    );
  } else {
    for (let index = 0; index < assessmentIds.length; index += 100) {
      const ids = assessmentIds.slice(index, index + 100);
      exportJobs.push(
        ...(await fetchAll((from, to) =>
          supabase
            .from('export_jobs')
            .select('id, assessment_id, state, created_at')
            .in('assessment_id', ids)
            .order('created_at', { ascending: false })
            .range(from, to),
        )),
      );
    }
  }

  const weeks = Array.from({ length: TREND_WEEKS }, (_, index) => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    start.setUTCDate(start.getUTCDate() - (TREND_WEEKS - index - 1) * 7);
    return { start, value: 0 };
  });
  for (const row of committedImports) {
    const start = weekStart(row.committed_at);
    if (!start) continue;
    const week = weeks.find((item) => item.start.getTime() === start.getTime());
    if (week) week.value += Number(row.row_count) || 0;
  }

  const activitySince = Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000;
  const recentActivity = [
    ...committedImports
      .filter((row) => Date.parse(row.committed_at) >= activitySince)
      .map((row) => activity(row.id, row.committed_at, 'Workbook import committed', '/imports')),
    ...assessments
      .filter((row) => Date.parse(row.updated_at) >= activitySince)
      .map((row) =>
        activity(
          row.id,
          row.updated_at,
          row.status === 'submitted' ? 'CAR submitted for review' : 'CAR assessment updated',
          row.status === 'submitted' ? '/review' : '/cars',
        ),
      ),
    ...exportJobs
      .filter((row) => row.state === 'failed' && Date.parse(row.created_at) >= activitySince)
      .map((row) => activity(row.id, row.created_at, 'Document export needs attention', '/templates')),
  ]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 5);

  return json({
    scope: systemScope ? 'system' : 'assigned',
    scopeLabel: systemScope ? 'System-wide live data' : 'Assigned staff live data',
    importsCommitted: committedImports.length,
    rowsProcessed: committedImports.reduce((total, row) => total + (Number(row.row_count) || 0), 0),
    householdsDetected: committedImports.reduce(
      (total, row) => total + (Number(row.household_count) || 0),
      0,
    ),
    granteeIssues,
    awaitingReview: pipeline.submitted,
    exportFailures: exportJobs.filter((row) => row.state === 'failed').length,
    carPipeline: pipeline,
    importTrend: weeks.map(({ start, value }) => ({ label: weekLabel(start), value })),
    recentActivity,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const user = await verifyJwt(req);
    const allowed = await hasActiveRole(user.id, DASHBOARD_ROLES);
    if (!allowed) throw new Error('forbidden');
    if (req.method !== 'GET') return error(405, 'method_not_allowed');

    const url = new URL(req.url);
    if (url.searchParams.get('action') !== 'summary') return error(404, 'not_found');
    const requestedScope = url.searchParams.get('scope') ?? 'assigned';
    if (requestedScope !== 'assigned' && requestedScope !== 'system') {
      return error(400, 'invalid_scope');
    }
    const systemScope = await hasActiveRole(user.id, ['admin']);
    if (requestedScope === 'system' && !systemScope) throw new Error('forbidden');
    return await dashboardSummary(getServiceClient(), user.id, systemScope);
  } catch (e) {
    return handleError(e);
  }
});
