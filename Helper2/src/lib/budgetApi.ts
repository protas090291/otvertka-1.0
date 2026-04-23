import { supabase } from './supabase';

// Типы для бюджета
export interface BudgetItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  type: 'expense' | 'income';
  date: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  budgeted: number;
  spent: number;
  variance: number;
  project_id: string;
}

export interface ProjectBudget {
  id: string;
  project_id: string;
  project_name: string;
  total_budget: number;
  spent: number;
  remaining: number;
  budget_usage_percent: number;
  categories: BudgetCategory[];
}

export interface BudgetItemInput {
  category: string;
  description: string;
  amount: number;
  type: 'expense' | 'income';
  project_id: string;
  date?: string;
}

export interface BudgetItemUpdate {
  category?: string;
  description?: string;
  amount?: number;
  type?: 'expense' | 'income';
  date?: string;
}

// API функции для работы с бюджетом

/**
 * Получить все бюджетные операции
 */
export const getAllBudgetItems = async (): Promise<BudgetItem[]> => {
  try {
    const { data, error } = await supabase
      .from('budget_items')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Ошибка получения бюджетных операций:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getAllBudgetItems:', error);
    return [];
  }
};

/**
 * Получить бюджетные операции по проекту
 */
export const getBudgetItemsByProject = async (projectId: string): Promise<BudgetItem[]> => {
  try {
    const { data, error } = await supabase
      .from('budget_items')
      .select('*')
      .eq('project_id', projectId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Ошибка получения бюджетных операций по проекту:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getBudgetItemsByProject:', error);
    return [];
  }
};

/**
 * Получить бюджетные операции по категории
 */
export const getBudgetItemsByCategory = async (category: string, projectId?: string): Promise<BudgetItem[]> => {
  try {
    let query = supabase
      .from('budget_items')
      .select('*')
      .eq('category', category)
      .order('date', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Ошибка получения бюджетных операций по категории:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Ошибка в getBudgetItemsByCategory:', error);
    return [];
  }
};

/**
 * Создать новую бюджетную операцию
 */
export const createBudgetItem = async (item: BudgetItemInput): Promise<BudgetItem | null> => {
  try {
    const { data, error } = await supabase
      .from('budget_items')
      .insert([{
        ...item,
        date: item.date || new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();

    if (error) {
      console.error('Ошибка создания бюджетной операции:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Ошибка в createBudgetItem:', error);
    return null;
  }
};

/**
 * Обновить бюджетную операцию
 */
export const updateBudgetItem = async (id: string, updates: BudgetItemUpdate): Promise<BudgetItem | null> => {
  try {
    const { data, error } = await supabase
      .from('budget_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Ошибка обновления бюджетной операции:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Ошибка в updateBudgetItem:', error);
    return null;
  }
};

/**
 * Удалить бюджетную операцию
 */
export const deleteBudgetItem = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('budget_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Ошибка удаления бюджетной операции:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Ошибка в deleteBudgetItem:', error);
    return false;
  }
};

/**
 * Получить бюджет проекта
 */
export const getProjectBudget = async (projectId: string): Promise<ProjectBudget | null> => {
  try {
    // В новой схеме projects нет колонки total_budget — берём только то, что есть.
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('Ошибка получения проекта:', projectError);
      throw projectError;
    }

    if (!projectData) {
      return null;
    }

    // Получаем все бюджетные операции по проекту
    const budgetItems = await getBudgetItemsByProject(projectId);

    // Вычисляем потраченную сумму
    const spent = budgetItems
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);

    // Общий бюджет проекта не хранится в БД в новой схеме — считаем по доходам.
    const totalBudget = budgetItems
      .filter(item => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);
    const remaining = totalBudget - spent;
    const budgetUsagePercent = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;

    // Группируем по категориям
    const categoryMap = new Map<string, BudgetCategory>();
    
    budgetItems.forEach(item => {
      const categoryName = item.category;
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          id: categoryName,
          name: categoryName,
          budgeted: 0,
          spent: 0,
          variance: 0,
          project_id: projectId
        });
      }
      
      const category = categoryMap.get(categoryName)!;
      if (item.type === 'expense') {
        category.spent += item.amount;
      }
    });

    // Вычисляем variance для каждой категории
    categoryMap.forEach(category => {
      category.variance = category.budgeted - category.spent;
    });

    return {
      id: projectId,
      project_id: projectId,
      project_name: projectData.name,
      total_budget: totalBudget,
      spent,
      remaining,
      budget_usage_percent: Math.round(budgetUsagePercent * 100) / 100,
      categories: Array.from(categoryMap.values())
    };
  } catch (error) {
    console.error('Ошибка в getProjectBudget:', error);
    return null;
  }
};

/**
 * Получить статистику бюджета
 */
export const getBudgetStats = async (projectId?: string): Promise<{
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  categoryBreakdown: { [category: string]: { income: number; expenses: number; net: number } };
}> => {
  try {
    let query = supabase.from('budget_items').select('*');
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Ошибка получения статистики бюджета:', error);
      throw error;
    }

    const items = data || [];
    
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryBreakdown: { [category: string]: { income: number; expenses: number; net: number } } = {};

    items.forEach(item => {
      if (!categoryBreakdown[item.category]) {
        categoryBreakdown[item.category] = { income: 0, expenses: 0, net: 0 };
      }

      if (item.type === 'income') {
        totalIncome += item.amount;
        categoryBreakdown[item.category].income += item.amount;
      } else {
        totalExpenses += item.amount;
        categoryBreakdown[item.category].expenses += item.amount;
      }
    });

    // Вычисляем net для каждой категории
    Object.keys(categoryBreakdown).forEach(category => {
      categoryBreakdown[category].net = 
        categoryBreakdown[category].income - categoryBreakdown[category].expenses;
    });

    return {
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
      categoryBreakdown
    };
  } catch (error) {
    console.error('Ошибка в getBudgetStats:', error);
    return {
      totalIncome: 0,
      totalExpenses: 0,
      netIncome: 0,
      categoryBreakdown: {}
    };
  }
};

/**
 * Экспорт бюджетных данных в CSV
 */
export const exportBudgetToCSV = async (projectId?: string): Promise<string> => {
  try {
    const items = projectId 
      ? await getBudgetItemsByProject(projectId)
      : await getAllBudgetItems();

    const headers = [
      'Дата',
      'Категория',
      'Описание',
      'Тип',
      'Сумма',
      'Проект'
    ];

    const csvRows = [headers.join(',')];

    items.forEach(item => {
      const row = [
        item.date,
        `"${item.category}"`,
        `"${item.description}"`,
        item.type === 'income' ? 'Доход' : 'Расход',
        item.amount,
        `"${item.project_id}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  } catch (error) {
    console.error('Ошибка экспорта бюджета в CSV:', error);
    return '';
  }
};
