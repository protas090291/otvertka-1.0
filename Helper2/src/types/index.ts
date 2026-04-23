export type UserRole = 'client' | 'foreman' | 'contractor' | 'worker' | 'storekeeper' | 'technadzor';
export type UserType = 'worker' | 'management'; // Тип пользователя: рабочий или руководство
export type ManagementRole = 'director' | 'deputy_director'; // Роли руководства

export interface AuthUser {
  email: string;
  password: string;
  userType: UserType;
  role?: UserRole | ManagementRole;
}

export interface Project {
  id: string;
  name: string;
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold';
  progress: number;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  client: string;
  foreman: string;
  architect: string;
  description: string;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'submitted_for_review' | 'returned_for_revision';
  assignee: string;
  startDate: string;
  endDate: string;
  progress: number;
  dependencies?: string[];
  order?: number; // Порядок сортировки внутри колонки
  /** ID исполнителя (кто выполняет задачу) */
  assigneeUserId?: string | null;
  /** ID создателя (кто поставил задачу, может подтвердить выполнение) */
  createdByUserId?: string | null;
  /** Комментарий проверяющего при возврате задачи на доработку */
  review_feedback?: string | null;
}

export interface Material {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  supplier: string;
  status: 'ordered' | 'delivered' | 'in-stock' | 'low-stock';
  projectId: string;
}

export interface Report {
  id: string;
  projectId: string;
  date: string;
  author: string;
  type: 'daily' | 'weekly' | 'milestone' | 'warehouse' | 'technadzor';
  title: string;
  description: string;
  photos: string[];
  attachments: string[];
}

export interface KPI {
  projectId: string;
  timelineAdherence: number;
  qualityScore: number;
  efficiencyScore: number;
  overallProgress: number;
}

export interface Defect {
  id: string;
  projectId: string;
  title: string;
  description: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  reportedBy: string;
  reportedDate: string;
  assignedTo?: string;
  dueDate?: string;
  resolvedDate?: string;
  photos: string[];
  videos: string[];
  comments: DefectComment[];
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'safety' | 'other';
  estimatedCost?: number;
  actualCost?: number;
  // Новые поля для отметок на планах
  apartmentNumber?: string;
  planMark?: PlanMark;
}

// Интерфейс для работы с дефектами Supabase
// Примечание: В БД status — enum('opened' | 'active' | 'resolved' | 'canceled'),
// но в UI-коде исторически используется пара 'active' | 'fixed'.
// Конвертация выполняется на границе API (см. hybridDefectsApi.ts).
export interface SupabaseDefect {
  id: string;
  apartment_id: string;
  title: string;
  description?: string | null;
  /** Вычисляемое поле: берётся из первой записи defect_images */
  photo_url?: string | null;
  status: 'active' | 'fixed';
  /** Детальный статус для UI (маппинг в DB enum) */
  status_detail?: 'open' | 'in-progress' | 'resolved' | 'closed';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  assigned_to?: string | null;
  created_by?: string | null;
  due_date?: string | null;
  x_coord: number;
  y_coord: number;
  created_at: string;
  updated_at: string;
}

// Статусы из DB (enum DefectStatus)
export type DbDefectStatus = 'opened' | 'active' | 'resolved' | 'canceled';
export type DbDefectSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface PlanMark {
  x: number; // Координата X в процентах
  y: number; // Координата Y в процентах
  room: string; // Название комнаты
  planUrl: string; // URL плана
  apartmentNumber: string; // Номер квартиры
  markId: string; // Уникальный ID отметки
}

export interface DefectComment {
  id: string;
  author: string;
  date: string;
  text: string;
  photos?: string[];
}

// Supabase типы
export interface SupabaseProject {
  id: string;
  name: string;
  description: string;
  address: string;
  status: 'planning' | 'construction' | 'completed';
  total_apartments: number;
  created_at: string;
  updated_at: string;
}

export interface SupabaseApartment {
  id: string;
  project_id: string | null;
  apartment_number: string | number;
  floor: number;
  area: number;
  rooms: number;
  status: string | null;
  price: number;
  building?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SupabaseArchitecturalPlan {
  id: string;
  apartment_id: string | null;
  file_url: string;
  created_at: string | null;
  updated_at: string | null;
  // Клиентские опциональные поля — не пишутся в БД.
  plan_type?: 'floor_plan' | 'elevation' | 'section' | '3d_model';
  file_name?: string;
  file_size?: number;
  building?: 'T' | 'U' | null;
}

// Типы для работы с прогрессом работ
export interface ProgressData {
  id: string;
  task_name: string;
  section: string;
  apartment_id: string;
  fact_progress: number;
  plan_progress: number;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface ProgressDataInput {
  task_name: string;
  section: string;
  apartment_id: string;
  fact_progress: number;
  plan_progress: number;
  updated_by?: string;
}

export interface ProgressDataUpdate {
  task_name?: string;
  section?: string;
  apartment_id?: string;
  fact_progress?: number;
  plan_progress?: number;
  updated_by?: string;
}