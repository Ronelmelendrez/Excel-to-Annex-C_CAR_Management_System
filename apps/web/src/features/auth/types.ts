export type UserRole = 'admin' | 'operator' | 'case_worker' | 'reviewer' | 'auditor';
export type Profile = {
  id: string;
  display_name: string | null;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
};
