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
    const { userId, role } = body;
    const supabase = getServiceClient();
    await auditLog({ actorId: user.id, action: 'assign_role', entityType: 'user_roles', entityId: userId, afterState: { role } });
    const { data, error: err } = await supabase.from('user_roles').insert({ user_id: userId, role, granted_by: user.id }).select().single();
    if (err) throw err;
    return json(data);
  } catch (e: any) {
    if (e.message === 'unauthorized') return error(401, 'unauthorized');
    if (e.message === 'forbidden') return error(403, 'forbidden');
    return error(500, 'internal_error');
  }
});
