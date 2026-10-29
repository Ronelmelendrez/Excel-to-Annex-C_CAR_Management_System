import { verifyJwt } from '../_shared/auth.ts';
import { enforceAdminOnly } from '../_shared/access.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { json, error } from '../_shared/http.ts';

Deno.serve(async (req) => {
  try {
    const user = await verifyJwt(req);
    await enforceAdminOnly(user.id);
    const supabase = getServiceClient();
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    return json({ profile, roles: (roles || []).map((r: any) => r.role) });
  } catch (e: any) {
    if (e.message === 'unauthorized') return error(401, 'unauthorized');
    if (e.message === 'forbidden') return error(403, 'forbidden');
    return error(500, 'internal_error');
  }
});
