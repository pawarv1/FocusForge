export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Category = 'COURSEWORK' | 'RESEARCH' | 'DEVELOPMENT' | 'CAREER' | 'OTHER';

export interface Task {
  id: number;
  title: string;
  description?: string | null;
  priority: Priority;
  category: Category;
  is_top3: boolean;
  is_completed: boolean;
  is_archived: boolean;
  due_date?: string | null;
  created_at: string;
}