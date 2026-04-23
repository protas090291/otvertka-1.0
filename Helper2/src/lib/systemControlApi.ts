// API для управления системой через AI помощника
import { supabase } from './supabase';
import { getAllDefects, getDefectsByApartment } from './hybridDefectsApi';
import { sendToAI, generateLetter as generateLetterAPI } from './aiApi';
import { notifyTaskCreated, notifyDefectCreated, triggerDataRefresh } from './dataSync';

// Интерфейсы для управления системой
export interface SystemInfo {
  projects: any[];
  apartments: any[];
  tasks: any[];
  defects: any[];
  workJournal: any[];
  statistics: {
    totalProjects: number;
    totalApartments: number;
    totalTasks: number;
    totalDefects: number;
    activeDefects: number;
    completedTasks: number;
  };
}

export interface SystemAction {
  type: string;
  target: string;
  parameters: Record<string, any>;
  result: any;
}

// Получение полной информации о системе
export const getSystemInfo = async (): Promise<SystemInfo> => {
  try {
    console.log('Получаем информацию о системе...');
    
    // Получаем все данные из системы
    const [defects, projects, apartments, tasks, workJournal] = await Promise.all([
      getAllDefects(),
      getProjects(),
      getApartments(),
      getTasks(),
      getWorkJournal()
    ]);

    // Подсчитываем статистику
    const statistics = {
      totalProjects: projects.length,
      totalApartments: apartments.length,
      totalTasks: tasks.length,
      totalDefects: defects.length,
      activeDefects: defects.filter(d => d.status === 'active').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length
    };

    return {
      projects,
      apartments,
      tasks,
      defects,
      workJournal,
      statistics
    };
  } catch (error) {
    console.error('Ошибка получения информации о системе:', error);
    throw error;
  }
};

// Получение проектов
const getProjects = async () => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn('Ошибка получения проектов:', error);
    return [];
  }
};

// Получение квартир
const getApartments = async () => {
  try {
    const { data, error } = await supabase
      .from('apartments')
      .select('*')
      .order('apartment_number', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn('Ошибка получения квартир:', error);
    return [];
  }
};

// Получение задач
const getTasks = async () => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.warn('Ошибка получения задач из Supabase:', error);
      // Fallback на localStorage
      return getTasksFromLocalStorage();
    }
    
    return data || [];
  } catch (error) {
    console.warn('Ошибка получения задач:', error);
    return getTasksFromLocalStorage();
  }
};

// Fallback: получение задач из localStorage
const getTasksFromLocalStorage = () => {
  try {
    const tasks = JSON.parse(localStorage.getItem('ai_tasks') || '[]');
    console.log('Получены задачи из localStorage:', tasks.length);
    return tasks;
  } catch (error) {
    console.error('Ошибка получения задач из localStorage:', error);
    return [];
  }
};

// Получение журнала работ
const getWorkJournal = async () => {
  try {
    const { data, error } = await supabase
      .from('work_journal')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50); // Последние 50 записей
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn('Ошибка получения журнала работ:', error);
    return [];
  }
};

// Выполнение действий в системе
export const executeSystemAction = async (action: SystemAction): Promise<any> => {
  try {
    console.log('Выполняем действие в системе:', action);
    
    switch (action.type) {
      case 'create_task':
        return await createTask(action.parameters);
      
      case 'update_task_status':
        return await updateTaskStatus(action.parameters);
      
      case 'create_defect':
        return await createDefect(action.parameters);
      
      case 'update_defect_status':
        return await updateDefectStatus(action.parameters);
      
      case 'get_apartment_info':
        return await getApartmentInfo(action.parameters.apartment_id);
      
      case 'get_project_status':
        return await getProjectStatus(action.parameters.project_id);
      
      case 'analyze_data':
        return await analyzeSystemData(action.parameters);
      
      case 'create_letter':
        console.log('🔧 Выполняем create_letter с параметрами:', action.parameters);
        return await createLetter(action.parameters);
      
      default:
        throw new Error(`Неизвестное действие: ${action.type}`);
    }
  } catch (error) {
    console.error('Ошибка выполнения действия:', error);
    throw error;
  }
};

// Создание задачи
const createTask = async (params: any) => {
  try {
    console.log('Создаем задачу с параметрами:', params);
    
    // Проверяем существование таблицы tasks
    const { data: tableCheck, error: tableError } = await supabase
      .from('tasks')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.error('Таблица tasks не существует или недоступна:', tableError);
      // Создаем задачу в localStorage как fallback
      return await createTaskInLocalStorage(params);
    }
    
    // Схема tasks: title, description, project_id, assigned_to, priority, status,
    // progress_percentage, start_date, end_date, created_by (NOT NULL, default ''), user_id, ...
    // Колонки apartment_id и due_date в таблице tasks НЕТ — используем end_date.
    const taskData: Record<string, any> = {
      title: params.name || params.title || 'Новая задача',
      description: params.description || 'Задача создана через AI помощника',
      assigned_to: params.assignee || params.assigned_to || 'Не назначен',
      status: 'pending',
      priority: params.priority || 'medium',
      end_date: params.due_date || params.end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_by: params.created_by || 'ai_assistant',
    };
    if (params.project_id) taskData.project_id = params.project_id;
    
    console.log('Данные для вставки:', taskData);
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single();
    
    if (error) {
      console.error('Ошибка Supabase при создании задачи:', error);
      // Fallback на localStorage
      return await createTaskInLocalStorage(params);
    }
    
    console.log('Задача успешно создана в Supabase:', data);
    
    // Уведомляем систему о создании задачи
    notifyTaskCreated(data);
    triggerDataRefresh();
    
    return data;
  } catch (error) {
    console.error('Ошибка создания задачи:', error);
    // Fallback на localStorage
    return await createTaskInLocalStorage(params);
  }
};

// Fallback: создание задачи в localStorage
const createTaskInLocalStorage = async (params: any) => {
  try {
    console.log('Создаем задачу в localStorage как fallback');
    
    const task = {
      id: `task-${Date.now()}`,
      name: params.name || 'Новая задача',
      description: params.description || 'Задача создана через AI помощника',
      apartment_id: params.apartment_id,
      assignee: params.assignee || 'Не назначен',
      status: 'pending',
      priority: params.priority || 'medium',
      due_date: params.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: params.created_by || 'ai_assistant',
      created_at: new Date().toISOString(),
      progress: 0
    };
    
    // Получаем существующие задачи
    const existingTasks = JSON.parse(localStorage.getItem('ai_tasks') || '[]');
    existingTasks.push(task);
    localStorage.setItem('ai_tasks', JSON.stringify(existingTasks));
    
    console.log('Задача создана в localStorage:', task);
    
    // Уведомляем систему о создании задачи
    notifyTaskCreated(task);
    triggerDataRefresh();
    
    return task;
  } catch (error) {
    console.error('Ошибка создания задачи в localStorage:', error);
    throw error;
  }
};

// Обновление статуса задачи
const updateTaskStatus = async (params: any) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ 
        status: params.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.task_id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Ошибка обновления статуса задачи:', error);
    throw error;
  }
};

// Создание дефекта — через hybridDefectsApi, чтобы сконвертить статус/фото и подставить
// обязательные поля (assigned_to/created_by/due_date/severity) из текущего пользователя.
const createDefect = async (params: any) => {
  try {
    const { createDefect: hybridCreateDefect } = await import('./hybridDefectsApi');
    const created = await hybridCreateDefect({
      apartment_id: params.apartment_id,
      title: params.title || 'Новый дефект',
      description: params.description || '',
      status: 'active',
      x_coord: params.x_coord ?? 50.0,
      y_coord: params.y_coord ?? 50.0,
    });

    if (!created) throw new Error('createDefect вернул null');

    notifyDefectCreated(created);
    triggerDataRefresh();

    return created;
  } catch (error) {
    console.error('Ошибка создания дефекта:', error);
    // Fallback на localStorage
    return await createDefectInLocalStorage(params);
  }
};

// Fallback: создание дефекта в localStorage
const createDefectInLocalStorage = async (params: any) => {
  try {
    console.log('Создаем дефект в localStorage как fallback');
    
    const defect = {
      id: `defect-${Date.now()}`,
      apartment_id: params.apartment_id,
      title: params.title || 'Новый дефект',
      description: params.description || 'Дефект создан через AI помощника',
      status: 'active',
      x_coord: params.x_coord || 50.0,
      y_coord: params.y_coord || 50.0,
      created_by: params.created_by || 'ai_assistant',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Получаем существующие дефекты
    const existingDefects = JSON.parse(localStorage.getItem('defects_data') || '[]');
    existingDefects.push(defect);
    localStorage.setItem('defects_data', JSON.stringify(existingDefects));
    
    console.log('Дефект создан в localStorage:', defect);
    
    // Уведомляем систему о создании дефекта
    notifyDefectCreated(defect);
    triggerDataRefresh();
    
    return defect;
  } catch (error) {
    console.error('Ошибка создания дефекта в localStorage:', error);
    throw error;
  }
};

// Обновление статуса дефекта (через hybridDefectsApi для корректного маппинга в DB enum)
const updateDefectStatus = async (params: any) => {
  try {
    const { updateDefectStatus: hybridUpdateStatus } = await import('./hybridDefectsApi');
    const updated = await hybridUpdateStatus(params.defect_id, params.status);
    if (!updated) throw new Error('updateDefectStatus вернул null');
    return updated;
  } catch (error) {
    console.error('Ошибка обновления статуса дефекта:', error);
    throw error;
  }
};

// Создание письма через обученную систему
const createLetter = async (params: any) => {
  try {
    console.log('🔧 Создаем письмо с параметрами:', params);
    console.log('🔧 Вызываем generateLetterAPI...');
    
    const result = await generateLetterAPI(
      params.apartment_id,
      params.issue_type,
      params.issue_description,
      params.contact_person,
      params.phone
    );
    
    console.log('🔧 Результат от generateLetterAPI:', result);
    
    if (result.success) {
      console.log('✅ Письмо успешно создано:', result.documentNumber);
      
      // Создаем URL для скачивания
      const fileName = result.filePath ? result.filePath.split('/').pop() : null;
      const downloadUrl = fileName ? `http://localhost:8000/documents/${fileName}` : null;
      
      console.log('🔧 Создан URL для скачивания:', downloadUrl);
      
      return {
        success: true,
        message: result.message,
        documentNumber: result.documentNumber,
        filePath: result.filePath,
        downloadUrl: downloadUrl,
        fileName: fileName
      };
    } else {
      console.error('❌ Ошибка в результате:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Ошибка создания письма:', error);
    throw error;
  }
};

// Получение информации о квартире
const getApartmentInfo = async (apartmentId: string) => {
  try {
    // В таблице tasks нет apartment_id, поэтому все задачи по квартире отфильтруем на клиенте по title/description.
    const apartmentNum = Number(apartmentId);
    const [apartment, defects, tasks] = await Promise.all([
      Number.isFinite(apartmentNum)
        ? supabase.from('apartments').select('*').eq('apartment_number', apartmentNum).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      getDefectsByApartment(apartmentId),
      supabase.from('tasks').select('*').or(`title.ilike.%${apartmentId}%,description.ilike.%${apartmentId}%`)
    ]);
    
    return {
      apartment: apartment.data,
      defects: defects,
      tasks: tasks.data || []
    };
  } catch (error) {
    console.error('Ошибка получения информации о квартире:', error);
    throw error;
  }
};

// Получение статуса проекта
const getProjectStatus = async (projectId: string) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Ошибка получения статуса проекта:', error);
    throw error;
  }
};

// Анализ данных системы
const analyzeSystemData = async (params: any) => {
  try {
    const systemInfo = await getSystemInfo();
    
    // Создаем контекст для AI анализа
    const analysisContext = `
    Анализ системы управления строительными проектами:
    
    Статистика:
    - Всего проектов: ${systemInfo.statistics.totalProjects}
    - Всего квартир: ${systemInfo.statistics.totalApartments}
    - Всего задач: ${systemInfo.statistics.totalTasks}
    - Всего дефектов: ${systemInfo.statistics.totalDefects}
    - Активных дефектов: ${systemInfo.statistics.activeDefects}
    - Завершенных задач: ${systemInfo.statistics.completedTasks}
    
    Последние дефекты:
    ${systemInfo.defects.slice(0, 5).map(d => `- ${d.title} (${d.apartment_id}) - ${d.status}`).join('\n')}
    
    Последние задачи:
    ${systemInfo.tasks.slice(0, 5).map(t => `- ${t.name} (${t.apartment_id}) - ${t.status}`).join('\n')}
    
    Запрос пользователя: ${params.query}
    `;
    
    const aiResponse = await sendToAI(params.query, analysisContext);
    return {
      analysis: aiResponse,
      data: systemInfo
    };
  } catch (error) {
    console.error('Ошибка анализа данных:', error);
    throw error;
  }
};

// Простые фразы — отвечаем сразу без вызова нейросети
const SIMPLE_REPLIES: Record<string, string> = {
  'ты тут': 'Да, я здесь. Чем могу помочь?',
  'ты здесь': 'Да, я здесь. Чем могу помочь?',
  'привет': 'Привет! Я помощник системы управления строительством. Чем могу помочь?',
  'здравствуй': 'Здравствуйте! Чем могу помочь?',
  'здравствуйте': 'Здравствуйте! Чем могу помочь?',
  'как дела': 'Всё в порядке, готов помочь с проектами, задачами или дефектами.',
  'кто ты': 'Я AI-помощник системы «Отвёртка»: могу помочь с задачами, дефектами, отчётами и документами.',
};

const normalizeForSimpleReply = (s: string) => s.toLowerCase().trim().replace(/[?!.]/g, '').replace(/\s+/g, ' ');

const SEARCH_API = 'http://localhost:8000/api/search';

/** Поиск в интернете через бэкенд (для контекста нейросети). */
async function searchWeb(query: string): Promise<string> {
  if (!query || query.trim().length < 2) return '';
  try {
    const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(query.trim())}`, { method: 'GET' });
    if (!res.ok) return '';
    const data = await res.json();
    const snippets = (data.snippets as string[] || []).filter(Boolean);
    return snippets.length ? `Данные из поиска в интернете:\n${snippets.slice(0, 6).map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}` : '';
  } catch {
    return '';
  }
}

/** Чат-помощник по строительству (как GPT/DeepSeek в системе): поиск в сети + ответ по строительной тематике. */
export const askConstructionAssistant = async (userInput: string): Promise<{ response: string }> => {
  const searchQuery = `${userInput.trim()} строительство`;
  const webContext = await searchWeb(searchQuery);
  const systemContext = `Ты — чат-помощник по строительной тематике (как GPT или DeepSeek внутри системы). Общайся свободно, можешь использовать данные из поиска в интернете. Темы: строительство в целом, нормы, СП, СНиП, технологии, практика, материалы — всё, что связано со строительством. Отвечай на русском, кратко и по делу.
${webContext ? `\nДанные из поиска в интернете:\n${webContext}\n` : ''}`;
  try {
    const response = await sendToAI(userInput, systemContext);
    return { response };
  } catch (err: any) {
    const msg = err?.message || String(err);
    return {
      response: msg.includes('ключ') || msg.includes('401') || msg.includes('OpenRouter')
        ? msg
        : `Нейросеть недоступна: ${msg}. Проверьте интернет и ключ OpenRouter в .env (VITE_OPENROUTER_API_KEY).`
    };
  }
};

// Умное управление системой через AI (оставлено для совместимости, чат использует askConstructionAssistant)
export const smartSystemControl = async (userInput: string, userRole: string): Promise<{
  response: string;
  actions: SystemAction[];
  data?: any;
}> => {
  try {
    console.log('🔧 Умное управление системой:', userInput);
    console.log('🔧 Роль пользователя:', userRole);

    const normalized = normalizeForSimpleReply(userInput);
    for (const [phrase, reply] of Object.entries(SIMPLE_REPLIES)) {
      if (normalized === phrase || normalized === phrase + '?' || normalized.startsWith(phrase + ' ')) {
        return { response: reply, actions: [] };
      }
    }
    
    // Получаем информацию о системе (не падаем при ошибке)
    let systemInfo: SystemInfo;
    try {
      systemInfo = await getSystemInfo();
    } catch (infoError) {
      console.warn('Ошибка получения информации о системе, используем пустой контекст:', infoError);
      systemInfo = {
        projects: [],
        apartments: [],
        tasks: [],
        defects: [],
        workJournal: [],
        statistics: {
          totalProjects: 0,
          totalApartments: 0,
          totalTasks: 0,
          totalDefects: 0,
          activeDefects: 0,
          completedTasks: 0
        }
      };
    }

    // Поиск в интернете — даём нейросети доступ к данным из сети
    const webSearchContext = await searchWeb(userInput);

    // Создаем контекст для AI (система + интернет)
    const systemContext = `
    Ты - AI помощник с полным доступом к системе управления строительными проектами и к данным из интернета.
    
    Текущая статистика системы:
    - Проектов: ${systemInfo.statistics.totalProjects}
    - Квартир: ${systemInfo.statistics.totalApartments}
    - Задач: ${systemInfo.statistics.totalTasks} (завершено: ${systemInfo.statistics.completedTasks})
    - Дефектов: ${systemInfo.statistics.totalDefects} (активных: ${systemInfo.statistics.activeDefects})
    
    ${webSearchContext ? `\n${webSearchContext}\n` : ''}
    
    Роль пользователя: ${userRole}
    
    Доступные действия:
    - Создание и управление задачами
    - Создание и управление дефектами
    - Анализ данных по квартирам и проектам
    - Получение статистики и отчетов
    - Управление статусами задач и дефектов
    - Ответы на вопросы по нормам, СП, СНиП, регламентам (используй данные из поиска выше, если есть)
    
    Запрос пользователя: "${userInput}"
    
    Проанализируй запрос и определи какие действия нужно выполнить. Если запрос про нормы, малярку, СП, регламенты — опирайся на данные из поиска в интернете. Отвечай естественно на русском языке.
    `;
    
    let aiResponse: string;
    try {
      aiResponse = await sendToAI(userInput, systemContext);
    } catch (aiError: any) {
      console.warn('Нейросеть недоступна:', aiError);
      const msg = aiError?.message || String(aiError);
      aiResponse = msg.includes('ключ') || msg.includes('401') || msg.includes('OpenRouter')
        ? msg
        : `Нейросеть недоступна: ${msg}. Проверьте интернет и ключ OpenRouter в .env (VITE_OPENROUTER_API_KEY).`;
    }
    
    // Определяем действия на основе запроса
    const actions: SystemAction[] = [];
    const lowerInput = userInput.toLowerCase();
    console.log('🔧 Обрабатываем команду:', userInput);
    console.log('🔧 Команда в нижнем регистре:', lowerInput);
    
    // Анализ запроса и определение действий
    if (lowerInput.includes('создай задачу') || lowerInput.includes('создать задачу') || 
        lowerInput.includes('добавь задачу') || lowerInput.includes('добавить задачу')) {
      const apartmentMatch = userInput.match(/квартир[аы]?\s*(\d+)/i);
      const apartmentId = apartmentMatch ? apartmentMatch[1] : 'общая';
      
      // Извлекаем название задачи из запроса
      let taskName = 'Новая задача';
      if (lowerInput.includes('задачу') && lowerInput.includes('по')) {
        const taskMatch = userInput.match(/задачу\s+(.+?)\s+по/i);
        if (taskMatch) {
          taskName = taskMatch[1].trim();
        }
      }
      
      actions.push({
        type: 'create_task',
        target: 'task',
        parameters: {
          name: taskName,
          description: userInput,
          apartment_id: apartmentId,
          created_by: userRole
        },
        result: null
      });
    }
    
    if (lowerInput.includes('создай дефект') || lowerInput.includes('создать дефект')) {
      const apartmentMatch = userInput.match(/квартир[аы]?\s*(\d+)/i);
      if (apartmentMatch) {
        actions.push({
          type: 'create_defect',
          target: 'defect',
          parameters: {
            apartment_id: apartmentMatch[1],
            title: 'Новый дефект',
            description: userInput,
            created_by: userRole
          },
          result: null
        });
      }
    }
    
    if (lowerInput.includes('статус') || lowerInput.includes('анализ') || lowerInput.includes('отчет')) {
      actions.push({
        type: 'analyze_data',
        target: 'system',
        parameters: {
          query: userInput
        },
        result: null
      });
    }
    
    // Обработка команд для создания писем
    console.log('🔧 Проверяем команду на создание письма:', lowerInput);
    if (lowerInput.includes('письмо') || lowerInput.includes('напиши') || lowerInput.includes('создай письмо') || lowerInput.includes('сгенерируй письмо')) {
      console.log('🔧 Команда содержит слова для создания письма!');
      // Улучшенное извлечение номера квартиры
      const apartmentPatterns = [
        /квартир[аы]?\s*(\d+)/i,           // "квартира 902"
        /в\s*квартир[еы]?\s*(\d+)/i,       // "в квартире 902"
        /по\s*квартир[аеы]?\s*(\d+)/i,     // "по квартире 902"
        /для\s*квартир[аы]?\s*(\d+)/i,     // "для квартиры 902"
        /квартир[аы]?\s*номер\s*(\d+)/i,   // "квартира номер 902"
        /(\d{3,4})/                        // просто номер 902, 1201
      ];
      
      let apartmentId = 'не указана';
      for (const pattern of apartmentPatterns) {
        const match = userInput.match(pattern);
        if (match) {
          apartmentId = match[1];
          break;
        }
      }
      
      // Определяем тип проблемы
      let issueType = 'техническая проблема';
      let issueDescription = userInput;
      
      if (lowerInput.includes('отоплени')) {
        issueType = 'проблема с отоплением';
        issueDescription = `обнаружена проблема с системой отопления в квартире ${apartmentId}, требующая технического решения`;
      } else if (lowerInput.includes('водоснабжени')) {
        issueType = 'проблема с водоснабжением';
        issueDescription = `обнаружена проблема с системой водоснабжения в квартире ${apartmentId}, требующая технического решения`;
      } else if (lowerInput.includes('электроснабжени')) {
        issueType = 'проблема с электроснабжением';
        issueDescription = `обнаружена проблема с системой электроснабжения в квартире ${apartmentId}, требующая технического решения`;
      } else if (lowerInput.includes('вентиляц')) {
        issueType = 'проблема с вентиляцией';
        issueDescription = `обнаружена проблема с системой вентиляции в квартире ${apartmentId}, требующая технического решения`;
      } else if (lowerInput.includes('канализац')) {
        issueType = 'проблема с канализацией';
        issueDescription = `обнаружена проблема с системой канализации в квартире ${apartmentId}, требующая технического решения`;
      } else if (lowerInput.includes('дефект')) {
        issueType = 'дефекты в отделке';
        issueDescription = `обнаружены дефекты в отделке квартиры ${apartmentId}, требующие устранения`;
      } else if (lowerInput.includes('смещени') && lowerInput.includes('срок')) {
        issueType = 'смещение сроков монтажа';
        issueDescription = `смещение сроков монтажа инженерных систем в квартире ${apartmentId}`;
      }
      
      console.log('🔧 Создаем действие create_letter для квартиры:', apartmentId);
      actions.push({
        type: 'create_letter',
        target: 'document',
        parameters: {
          apartment_id: apartmentId,
          issue_type: issueType,
          issue_description: issueDescription,
          contact_person: 'Ответственное лицо',
          phone: '+7 (XXX) XXX-XX-XX'
        },
        result: null
      });
    }
    
    // Выполняем действия
    console.log('🔧 Выполняем', actions.length, 'действий:', actions.map(a => a.type));
    const results = [];
    for (const action of actions) {
      try {
        console.log('🔧 Выполняем действие:', action.type);
        const result = await executeSystemAction(action);
        action.result = result;
        results.push(result);
        console.log('✅ Действие выполнено успешно:', action.type);
      } catch (error) {
        console.error('❌ Ошибка выполнения действия:', error);
        action.result = { error: error.message };
      }
    }
    
    console.log('🔧 Возвращаем результат smartSystemControl:', {
      response: aiResponse,
      actionsCount: actions.length,
      resultsCount: results.length,
      data: results.length > 0 ? results : null
    });
    
    return {
      response: aiResponse,
      actions,
      data: results.length > 0 ? results : null
    };
    
  } catch (error) {
    console.error('Ошибка умного управления системой:', error);
    return {
      response: 'Произошла ошибка при обработке запроса. Попробуйте еще раз.',
      actions: []
    };
  }
};
