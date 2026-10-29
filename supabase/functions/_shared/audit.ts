import { getServiceClient } from './supabase.ts';
export async function auditLog(params: any) {
  const supabase = getServiceClient();
  await supabase.from('audit_logs').insert({
    actor_id: params.actorId || null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId || null,
    before_state: params.beforeState || null,
    after_state: params.afterState || null,
  });
}
