export interface ICaseTable {
  page: number;
  pageSize: number;
  items: ICaseTableItem[];
  total: number;
}

export interface ICaseTableItem {
  id: string;
  title: string;
  description: string | null;
  complainant_name: string | null;
  district: string | null;
  local_level: string | null;
  ward: string | null;
  place: string | null;
  category: string | null;
  normalized_status: string;
  department_name: string | null;
  decision: string | null;
  decision_reason: string | null;
  employee_name: string | null;
  employee_role: string | null;
  recommendation_outcome: string | null;
  recommended_next_step: string | null;
  calculated_deadline: string | null;
}