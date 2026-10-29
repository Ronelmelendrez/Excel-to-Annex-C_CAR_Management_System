import { getServiceClient } from './supabase.ts';
export async function isAdmin(userId: string) {
  const supabase = getServiceClient();
  const { data: profile } = await supabase.from('profiles').select('status').eq('id', userId).single();
  if (!profile || profile.status !== 'active') return false;
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  return (roles || []).some((r: any) => r.role === 'admin');
}
export async function hasRole(userId: string, roles: string[]) {
  const supabase = getServiceClient();
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  const userRoles = (data || []).map((r: any) => r.role);
  return roles.some(r => userRoles.includes(r));
}

/** Role check that also rejects disabled profiles. */
export async function hasActiveRole(userId: string, roles: string[]) {
  const supabase = getServiceClient();
  const { data: profile } = await supabase.from('profiles').select('status').eq('id', userId).maybeSingle();
  if (!profile || profile.status !== 'active') return false;
  return hasRole(userId, roles);
}
