import { verifyJwt } from '../_shared/auth.ts';
import { enforceAdminOnly } from '../_shared/access.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { isAdmin } from '../_shared/rbac.ts';
import { auditLog } from '../_shared/audit.ts';
import { json, error } from '../_shared/http.ts';

Deno.serve(async (req) => {
  try {
    const user = await verifyJwt(req);
    await enforceAdminOnly(user.id);
    if (!(await isAdmin(user.id))) return error(403, 'forbidden');
    const body = await req.json();
    const { mode } = body;
    const supabase = getServiceClient();
    await auditLog({ actorId: user.id, action: 'set_access_mode', entityType: 'system_settings', entityId: 'access_mode', afterState: { mode } });
    const { data, error: err } = await supabase.from('system_settings').upsert({ key: 'access_mode', value: mode, updated_by: user.id }).select().single();
    if (err) throw err;
    return json(data);
  } catch (e: any) {
    if (e.message === 'unauthorized') return error(401, 'unauthorized');
    if (e.message === 'forbidden') return error(403, 'forbidden');
    return error(500, 'internal_error');
  }
});
