import { verifyJwt } from '../_shared/auth.ts';
import { enforceAdminOnly } from '../_shared/access.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { isAdmin } from '../_shared/rbac.ts';
import { json, error } from '../_shared/http.ts';

Deno.serve(async (req) => {
  try {
    const user = await verifyJwt(req);
    await enforceAdminOnly(user.id);
    if (!(await isAdmin(user.id))) return error(403, 'forbidden');
    const supabase = getServiceClient();
    const { data } = await supabase.from('profiles').select('*, user_roles(role)').order('created_at');
    return json(data);
  } catch (e: any) {
    if (e.message === 'unauthorized') return error(401, 'unauthorized');
    if (e.message === 'forbidden') return error(403, 'forbidden');
    return error(500, 'internal_error');
  }
});
