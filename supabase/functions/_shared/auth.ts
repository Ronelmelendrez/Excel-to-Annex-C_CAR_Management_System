export async function verifyJwt(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw new Error('unauthorized');
  const { getServiceClient } = await import('./supabase.ts');
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('unauthorized');
  return data.user;
}
