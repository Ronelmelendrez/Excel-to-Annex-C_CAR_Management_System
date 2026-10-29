import { getServiceClient } from './supabase.ts';
import { isAdmin } from './rbac.ts';
export async function enforceAdminOnly(userId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase.from('system_settings').select('value').eq('key', 'access_mode').single();
  if (data?.value === 'admin_only') {
    const admin = await isAdmin(userId);
    if (!admin) throw new Error('forbidden');
  }
}
