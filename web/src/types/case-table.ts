export interface ICaseTable {
  page: number;
  pageSize: number;
  items: ICaseTableItem[];
  total: number;
}

export interface ICaseTableItem {
  id: string;
  title: string;
  normalized_status: string;
  department_name: string | null;
  recommendation_outcome: string | null;
  follow_up_due_date: string | null;
}