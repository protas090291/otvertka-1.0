import { supabase } from './supabase';

// Типы для отчетов
export interface Report {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'milestone' | 'warehouse' | 'technadzor' | 'contractor'; // Типы, разрешённые в базе данных
  project_id: string;
  apartment_id?: string;
  description: string;
  content: string;
  photos: string[];
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  author?: string; // Имя автора
}

export interface ReportInput {
  title: string;
  type: 'daily' | 'weekly' | 'milestone' | 'warehouse' | 'technadzor' | 'contractor'; // Типы, разрешённые в базе данных
  project_id: string;
  apartment_id?: string;
  description: string;
  content: string;
  photos?: string[];
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
  notes?: string;
  created_by?: string; // ID пользователя, создавшего отчёт
  author?: string; // Имя автора (обязательное поле в базе данных)
}

export interface ReportUpdate {
  title?: string;
  type?: 'daily' | 'weekly' | 'milestone' | 'warehouse' | 'technadzor' | 'contractor';
  project_id?: string;
  apartment_id?: string;
  description?: string;
  content?: string;
  photos?: string[];
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  author?: string;
}

export interface ReportStats {
  totalReports: number;
  draftReports: number;
  pendingReports: number;
  approvedReports: number;
  rejectedReports: number;
  typeBreakdown: {
    [type: string]: number;
  };
  recentReports: Report[];
}

// API функции для работы с отчетами

/**
 * Получить все отчеты
 */
export const getAllReports = async (): Promise<Report[]> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка получения отчетов:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getAllReports:', error);
    return [];
  }
};

/**
 * Получить отчет по ID
 */
export const getReportById = async (id: string): Promise<Report | null> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Ошибка получения отчета:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Ошибка в getReportById:', error);
    return null;
  }
};

/**
 * Получить отчеты по проекту
 */
export const getReportsByProject = async (projectId: string): Promise<Report[]> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка получения отчетов по проекту:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getReportsByProject:', error);
    return [];
  }
};

/**
 * Получить отчеты по квартире
 */
export const getReportsByApartment = async (apartmentId: string): Promise<Report[]> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('apartment_id', apartmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка получения отчетов по квартире:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getReportsByApartment:', error);
    return [];
  }
};

/**
 * Получить отчеты по типу
 */
export const getReportsByType = async (type: string): Promise<Report[]> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка получения отчетов по типу:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getReportsByType:', error);
    return [];
  }
};

/**
 * Получить отчеты по статусу
 */
export const getReportsByStatus = async (status: string): Promise<Report[]> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка получения отчетов по статусу:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getReportsByStatus:', error);
    return [];
  }
};

/**
 * Поиск отчетов
 */
export const searchReports = async (searchTerm: string): Promise<Report[]> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка поиска отчетов:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в searchReports:', error);
    return [];
  }
};

/**
 * Создать новый отчет
 */
export const createReport = async (report: ReportInput): Promise<Report | null> => {
  try {
    console.log('createReport вызван с данными:', report);
    
    const { data, error } = await supabase
      .from('reports')
      .insert([{
        ...report,
        status: report.status || 'draft',
        photos: report.photos || []
      }])
      .select()
      .single();

    if (error) {
      console.error('Ошибка создания отчета:', error);
      console.error('Детали ошибки:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    console.log('Отчёт успешно создан:', data);
    return data;
  } catch (error) {
    console.error('Ошибка в createReport:', error);
    // Пробрасываем ошибку дальше, чтобы компонент мог её обработать
    throw error;
  }
};

/**
 * Обновить отчет
 */
export const updateReport = async (id: string, updates: ReportUpdate): Promise<Report | null> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Ошибка обновления отчета:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Ошибка в updateReport:', error);
    return null;
  }
};

/**
 * Одобрить отчет
 */
export const approveReport = async (id: string, approvedBy: string): Promise<Report | null> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Ошибка одобрения отчета:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Ошибка в approveReport:', error);
    return null;
  }
};

/**
 * Отклонить отчет
 */
export const rejectReport = async (id: string, notes?: string): Promise<Report | null> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .update({
        status: 'rejected',
        notes: notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Ошибка отклонения отчета:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Ошибка в rejectReport:', error);
    return null;
  }
};

/**
 * Удалить отчет
 */
export const deleteReport = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Ошибка удаления отчета:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Ошибка в deleteReport:', error);
    return false;
  }
};

/**
 * Загрузить фото к отчету
 */
export const uploadReportPhoto = async (file: File, reportId: string): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    // В проекте есть всего 2 бакета: plan и defects_images. Фото отчётов кладём в defects_images
    // (префикс report- в имени файла, чтобы отличать от фото дефектов).
    const fileName = `report-${reportId}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error } = await supabase.storage
      .from('defects_images')
      .upload(filePath, file);

    if (error) {
      console.error('Ошибка загрузки фото отчета:', error);
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('defects_images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Ошибка в uploadReportPhoto:', error);
    return null;
  }
};

/**
 * Получить статистику отчетов
 */
export const getReportStats = async (): Promise<ReportStats> => {
  try {
    const reports = await getAllReports();
    
    let totalReports = reports.length;
    let draftReports = 0;
    let pendingReports = 0;
    let approvedReports = 0;
    let rejectedReports = 0;
    const typeBreakdown: { [type: string]: number } = {};

    reports.forEach(report => {
      switch (report.status) {
        case 'draft':
          draftReports++;
          break;
        case 'pending':
          pendingReports++;
          break;
        case 'approved':
          approvedReports++;
          break;
        case 'rejected':
          rejectedReports++;
          break;
      }

      typeBreakdown[report.type] = (typeBreakdown[report.type] || 0) + 1;
    });

    // Получаем последние 5 отчетов
    const recentReports = reports.slice(0, 5);

    return {
      totalReports,
      draftReports,
      pendingReports,
      approvedReports,
      rejectedReports,
      typeBreakdown,
      recentReports
    };
  } catch (error) {
    console.error('Ошибка в getReportStats:', error);
    return {
      totalReports: 0,
      draftReports: 0,
      pendingReports: 0,
      approvedReports: 0,
      rejectedReports: 0,
      typeBreakdown: {},
      recentReports: []
    };
  }
};

/**
 * Получить отчеты, требующие внимания
 */
export const getReportsRequiringAttention = async (): Promise<Report[]> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .in('status', ['pending', 'rejected'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка получения отчетов, требующих внимания:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getReportsRequiringAttention:', error);
    return [];
  }
};

/**
 * Экспорт отчетов в CSV
 */
export const exportReportsToCSV = async (): Promise<string> => {
  try {
    const reports = await getAllReports();

    const headers = [
      'Название',
      'Тип',
      'Проект',
      'Квартира',
      'Описание',
      'Статус',
      'Автор',
      'Создан',
      'Одобрен',
      'Одобрил',
      'Заметки'
    ];

    const csvRows = [headers.join(',')];

    reports.forEach(report => {
      const row = [
        `"${report.title}"`,
        report.type,
        `"${report.project_id}"`,
        report.apartment_id || '',
        `"${report.description}"`,
        report.status,
        `"${report.created_by}"`,
        new Date(report.created_at).toLocaleDateString('ru'),
        report.approved_at ? new Date(report.approved_at).toLocaleDateString('ru') : '',
        report.approved_by || '',
        `"${report.notes || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  } catch (error) {
    console.error('Ошибка экспорта отчетов в CSV:', error);
    return '';
  }
};
