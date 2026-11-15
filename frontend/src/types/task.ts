export type Priority = 'UNASSIGNED' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface MicroStep {
  id: number;
  google_task_id: string;
  title: string;
  is_done: boolean;
  position: number;
}

export interface Task {
  // Sourced from Google Tasks API
  google_task_id: string;
  google_list_id: string;
  category: string;
  title: string;
  notes?: string | null;
  due_date?: string | null;
  is_completed: boolean;

  // Sourced from local TaskEnrichmentModel
  priority: Priority;
  previous_priority?: Priority | null;
  is_top3: boolean;
  estimated_minutes?: number | null;
  assigned_block_start?: string | null;
  steps: MicroStep[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  startIso: string;
  startTime: string;
  endTime: string;
  startHour: number;
  durationHours: number;
  isFocusBlock: boolean;
}