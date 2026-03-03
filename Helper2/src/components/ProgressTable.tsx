import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Check, Edit, X, Search, Filter, Download, ChevronDown, ChevronRight, Eye, EyeOff, Loader2, Upload } from 'lucide-react';
import { UserRole, ProgressData } from '../types';
import { getAllProgressData, upsertProgressData, exportProgressDataToCSV, createWorkWithZeroes } from '../lib/progressApi';
import { normalizeApartmentId } from '../lib/dataNormalizer';
import { getCurrentUser } from '../lib/authApi';
import ProgressTableImporter from './ProgressTableImporter';

interface ProgressTableProps {
  userRole: UserRole;
}

interface TaskProgress {
  [taskName: string]: {
    [section: string]: {
      [floor: string]: {
        fact: number;
        plan: number;
      };
    };
  };
}

// Правильный порядок работ по разделам (согласованный список)
const TASK_ORDER: Record<string, string[]> = {
  "Отделочные работы": [
    "Устройство металлического каркаса перегородок и стен",
    "Монтаж гипсокартона под стяжку (400 мм от пола)",
    "Гидроизоляция пола в санузлах под конвекторами",
    "Гидроизоляция общая",
    "Заливка стяжки из пенополистирол бетона",
    "Заливка чистовой стяжки",
    "Шумоизоляция стен",
    "Обшивка каркаса листами ГКЛ стен",
    "Обшивка каркаса листами ГКЛ потолков",
    "Шпаклевка стен (база)",
    "Шпаклевка потолка (база)",
    "Гидроизоляция обмазочная",
    "Кладка камня на стенах",
    "Кладка камня на полу",
    "Укладка фанеры на пол"
  ],
  "Работы по ОВК": [
    "Монтаж воздуховодов систем вентиляции",
    "Монтаж наружных блоков кондиционеров",
    "Монтаж внутренних блоков кондиционеров",
    "Монтаж дренажа",
    "Монтаж фреонопровода",
    "Монтаж вентустановки",
    "Монтаж вентрешеток",
    "ПНР систем ОВИК",
    "Монтаж черновой сантехники",
    "Монтаж трубопроводов водоснабжения",
    "Сборка сантехнических шкафов",
    "Монтаж трубопроводов канализации",
    "Монтаж санфаянса, сифонов и смесителей",
    "Монтаж душевых перегородок",
    "ПНР системы водоснабжения",
    "Демонтаж/монтаж внутрипольных конвекторов",
    "Демонтаж/монтаж трубопроводов отопления",
    "Монтаж коллекторного шкафа отопления",
    "ПНР системы отопления"
  ],
  "Работы по ЭОМ+АСУ": [
    "Монтаж кабельных трасс по потолку",
    "Монтаж кабельных трасс по полу",
    "Установка щитов и лотоков",
    "Завод кабеля в щит с потолка",
    "Завод кабеля в щит с пола",
    "Наращивание кабеля на воронку",
    "Завод кабеля в щит приходящих с МОП",
    "Монтаж заземления инсталляции",
    "Установка закладных для датчиков теплого пола",
    "Монтаж подрозетников в санузлах для вывода датчика протечки",
    "Монтаж силового щита",
    "Монтаж слаботочного щита",
    "Монтаж КУП"
  ]
};

const ProgressTable: React.FC<ProgressTableProps> = ({ userRole }) => {
  // Состояние для навигации и фильтров
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('Отделочные работы');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [floorGroup, setFloorGroup] = useState(0);
  
  // Состояние для работы с базой данных
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWorkName, setNewWorkName] = useState('');
  const [newWorkSection, setNewWorkSection] = useState<'Отделочные работы' | 'Работы по ОВК' | 'Работы по ЭОМ+АСУ'>('Отделочные работы');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  // Флаг: уже инициализировано из БД (используем для защиты от очистки таблицы пустым ответом)
  const initializedFromDbRef = useRef(false);

  // Создаем базовую структуру для всех квартир
  // Убраны дубликаты с суффиксом "-И" - используются только правильные номера квартир
  const createEmptyFloorData = () => ({
    'T101': { fact: 0, plan: 0 },
    'T201': { fact: 0, plan: 0 },
    'T202': { fact: 0, plan: 0 },
    'T203': { fact: 0, plan: 0 },
    'T301': { fact: 0, plan: 0 },
    'T302': { fact: 0, plan: 0 },
    'T303': { fact: 0, plan: 0 },
    'T401': { fact: 0, plan: 0 },
    'T402': { fact: 0, plan: 0 },
    'T403': { fact: 0, plan: 0 },
    'T404': { fact: 0, plan: 0 },
    'T501': { fact: 0, plan: 0 },
    'T502': { fact: 0, plan: 0 },
    'T503': { fact: 0, plan: 0 },
    'T504': { fact: 0, plan: 0 },
    'T601': { fact: 0, plan: 0 },
    'T602': { fact: 0, plan: 0 },
    'T603': { fact: 0, plan: 0 },
    'T604': { fact: 0, plan: 0 },
    'T701': { fact: 0, plan: 0 },
    'T702': { fact: 0, plan: 0 },
    'T703': { fact: 0, plan: 0 },
    'T704': { fact: 0, plan: 0 },
    'T801': { fact: 0, plan: 0 },
    'T802': { fact: 0, plan: 0 },
    'T803': { fact: 0, plan: 0 },
    'T804': { fact: 0, plan: 0 },
    'T901': { fact: 0, plan: 0 },
    'T902': { fact: 0, plan: 0 },
    'T903': { fact: 0, plan: 0 },
    'T904': { fact: 0, plan: 0 },
    'T1001': { fact: 0, plan: 0 },
    'T1002': { fact: 0, plan: 0 },
    'T1003': { fact: 0, plan: 0 },
    'T1004': { fact: 0, plan: 0 },
    'T1101': { fact: 0, plan: 0 },
    'T1102': { fact: 0, plan: 0 },
    'T1103': { fact: 0, plan: 0 },
    'T1104': { fact: 0, plan: 0 },
    'T1201': { fact: 0, plan: 0 },
    'T1202': { fact: 0, plan: 0 },
    'T1203': { fact: 0, plan: 0 },
    'T1204': { fact: 0, plan: 0 },
    'T1301': { fact: 0, plan: 0 },
    'T1302': { fact: 0, plan: 0 },
    'T1401': { fact: 0, plan: 0 },
    'У501': { fact: 0, plan: 0 },
    'У502': { fact: 0, plan: 0 },
    'У503': { fact: 0, plan: 0 },
    'У504': { fact: 0, plan: 0 },
    'У704': { fact: 0, plan: 0 }
  });

  // Загрузка данных из базы
  useEffect(() => {
    loadProgressData();
  }, []);

  // Если пользователь меняет фильтр секции во время открытой формы — синхронизируем поле формы
  useEffect(() => {
    if (showAddForm) {
      setNewWorkSection(selectedSection as any);
    }
  }, [selectedSection, showAddForm]);

  const loadProgressData = async () => {
    try {
      latestRequestId.current += 1;
      const requestId = latestRequestId.current;
      setLoading(true);
      console.log('🔄 ProgressTable: Загрузка данных прогресса...');
      const data = await getAllProgressData();
      console.log('📦 ProgressTable: Получено данных:', data?.length || 0, data);
      
      if (requestId !== latestRequestId.current) {
        console.log('⏭️ ProgressTable: Устаревший запрос, игнорируем');
        return; // игнорируем устаревший ответ
      }
      
      // Если пришел пустой ответ, не затираем уже отрисованные данные (защита от мигающего исчезновения)
      if (!data || data.length === 0) {
        console.log('⚠️ ProgressTable: пустой ответ, сохраняем текущее состояние таблицы');
        // Если еще не было успешной инициализации из БД, просто оставляем дефолтные данные
        if (!initializedFromDbRef.current) {
          console.log('ℹ️ ProgressTable: Первая загрузка, данные пустые, используем дефолтные');
        }
        return;
      }
      
      console.log('✅ ProgressTable: Данные получены, обновляем состояние');
      setProgressData(data);
      // Полная сборка из БД, чтобы значения точно совпадали с базой
      const progressFromDB = buildProgressFromDb(data);
      console.log('🔨 ProgressTable: Построен прогресс из БД:', Object.keys(progressFromDB).length, 'задач');
      setProgress(progressFromDB);
      // Диагностика: сравнение наборов работ (приложение vs БД)
      const dbWorks = Array.from(new Set(data.map(d => `${d.section} | ${d.task_name}`))).sort();
      const appWorks = Object.keys(progressFromDB)
        .flatMap(task => Object.keys(progressFromDB[task]).map(section => `${section} | ${task}`))
        .sort();
      console.log('🗄️ DB works:', dbWorks);
      console.log('🖥️ App works:', appWorks);
      console.log('✅ Совпадают ли наборы работ:', JSON.stringify(dbWorks) === JSON.stringify(appWorks));
      initializedFromDbRef.current = true;
    } catch (error) {
      console.error('❌ Ошибка загрузки данных прогресса:', error);
    } finally {
      setLoading(false);
    }
  };

  // Защита от гонок: применяем только последний ответ
  const latestRequestId = useRef(0);

  // Функция для преобразования данных из базы в формат компонента (чистая сборка из БД)
  const buildProgressFromDb = (data: ProgressData[]): TaskProgress => {
    const result: TaskProgress = {};
    data.forEach(item => {
      const normalizedTask = (item.task_name || '').trim();
      const normalizedSection = (item.section || '').trim();
      // Нормализуем ID квартиры в единый формат (T + номер)
      const normalizedApt = normalizeApartmentId(item.apartment_id || '');

      if (!result[normalizedTask]) {
        result[normalizedTask] = {} as any;
      }
      if (!result[normalizedTask][normalizedSection]) {
        // создаём полный набор квартир с нулями, чтобы таблица была полной
        result[normalizedTask][normalizedSection] = { ...createEmptyFloorData() } as any;
      }
      result[normalizedTask][normalizedSection][normalizedApt] = {
        fact: item.fact_progress,
        plan: item.plan_progress
      } as any;
    });
    return result;
  };
  
  // Мягкое слияние новых данных из БД в текущее состояние без удаления отсутствующих
  const mergeDbIntoProgress = (prev: TaskProgress, db: TaskProgress): TaskProgress => {
    const next: TaskProgress = { ...prev };
    Object.keys(db).forEach(task => {
      if (!next[task]) next[task] = {} as any;
      Object.keys(db[task]).forEach(section => {
        if (!next[task][section]) next[task][section] = { ...createEmptyFloorData() } as any;
        const floorsMap = db[task][section];
        Object.keys(floorsMap).forEach(apartment => {
          const cell = floorsMap[apartment] as { fact: number; plan: number };
          if (!next[task][section][apartment]) next[task][section][apartment] = { fact: 0, plan: 0 } as any;
          next[task][section][apartment] = {
            fact: typeof cell.fact === 'number' ? cell.fact : (next[task][section][apartment].fact || 0),
            plan: typeof cell.plan === 'number' ? cell.plan : (next[task][section][apartment].plan || 0),
          } as any;
        });
      });
    });
    return next;
  };

  // Чистое состояние: наполняется из БД
  const [progress, setProgress] = useState<TaskProgress>({});

  const [editingCell, setEditingCell] = useState<{ task: string; section: string; floor: string; type: 'fact' | 'plan' } | null>(null);
  const [inputValue, setInputValue] = useState<string>('');

  const canEdit = userRole === 'technadzor' || userRole === 'contractor' || userRole === 'foreman';

  const floors = [
    'T101', 'T201', 'T202-И', 'T203', 'T301', 'T302', 'T303', 'T401', 'T402', 'T403-И', 'T404',
    'T501', 'T502', 'T503-И', 'T504-И', 'T601', 'T602', 'T603', 'T604', 'T701', 'T702-И', 'T703-И', 'T704-И',
    'T801-И', 'T802', 'T803', 'T804', 'T901', 'T902-И', 'T903', 'T904', 'T1001', 'T1002', 'T1003', 'T1004',
    'T1101', 'T1102', 'T1103', 'T1104', 'T1201', 'T1202', 'T1203-И', 'T1204', 'T1301-И', 'T1302', 'T1401',
    'У501', 'У502', 'У503', 'У504', 'У704'
  ];

  // Группировка по реальным этажам
  const floorGroups = useMemo(() => {
    const floorMap: { [floor: number]: string[] } = {};
    
    floors.forEach(apartment => {
      let floorNumber: number;
      
      if (apartment.startsWith('T')) {
        const number = apartment.substring(1).replace(/[^0-9]/g, '');
        if (number.length === 3) {
          floorNumber = parseInt(number[0]);
        } else if (number.length === 4) {
          floorNumber = parseInt(number.substring(0, 2));
        } else {
          floorNumber = 1;
        }
      } else if (apartment.startsWith('У')) {
        const number = apartment.substring(1).replace(/[^0-9]/g, '');
        if (number.length === 3) {
          floorNumber = parseInt(number[0]);
        } else {
          floorNumber = 1;
        }
      } else {
        floorNumber = 1;
      }
      
      if (!floorMap[floorNumber]) {
        floorMap[floorNumber] = [];
      }
      floorMap[floorNumber].push(apartment);
    });
    
    const sortedFloors = Object.keys(floorMap).map(Number).sort((a, b) => a - b);
    return sortedFloors.map(floor => ({
      floorNumber: floor,
      apartments: floorMap[floor].sort()
    }));
  }, [floors]);

  const currentFloorData = floorGroups[floorGroup] || { floorNumber: 0, apartments: [] };
  const currentFloors = currentFloorData.apartments;

  const getCellColor = (value: number) => {
    if (value === 100) return 'bg-emerald-500/25 text-emerald-200 border-emerald-500/40';
    if (value >= 75) return 'bg-blue-500/25 text-blue-200 border-blue-500/40';
    if (value >= 50) return 'bg-amber-500/25 text-amber-200 border-amber-500/40';
    if (value >= 25) return 'bg-orange-500/25 text-orange-200 border-orange-500/40';
    if (value > 0) return 'bg-red-500/25 text-red-200 border-red-500/40';
    return 'bg-white/5 text-slate-400 border-white/10';
  };

  const getProgressBarColor = (value: number) => {
    if (value === 100) return 'from-emerald-500 to-green-600';
    if (value >= 75) return 'from-blue-500 to-blue-600';
    if (value >= 50) return 'from-amber-500 to-yellow-600';
    if (value >= 25) return 'from-orange-500 to-orange-600';
    if (value > 0) return 'from-red-500 to-red-600';
    return 'from-slate-500 to-slate-600';
  };

  const handleCellClick = (task: string, section: string, floor: string, type: 'fact' | 'plan', currentValue: number) => {
    if (canEdit) {
      setEditingCell({ task, section, floor, type });
      setInputValue(currentValue.toString());
    }
  };

  // Функция для удаления ведущих нулей из ввода
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Убираем ведущие нули, но оставляем "0" если это единственный символ
    if (value.length > 1 && value.startsWith('0')) {
      // Убираем все ведущие нули
      value = value.replace(/^0+/, '');
      // Если после удаления нулей ничего не осталось, оставляем "0"
      if (value === '') {
        value = '0';
      }
    }
    
    setInputValue(value);
  };

  const handleSave = async () => {
    if (editingCell) {
      const { task, section, floor, type } = editingCell;
      const newValue = parseInt(inputValue) || 0;
      
      try {
        setSaving(true);

        // Обновляем локальное состояние
      setProgress(prev => ({
        ...prev,
        [task]: {
          ...prev[task],
          [section]: {
            ...prev[task][section],
            [floor]: {
              ...prev[task][section][floor],
              [type]: newValue
            }
          }
        }
      }));

        // Получаем текущие значения для сохранения
        const currentData = progress[task]?.[section]?.[floor] || { fact: 0, plan: 0 };
        const factProgress = type === 'fact' ? newValue : currentData.fact;
        const planProgress = type === 'plan' ? newValue : currentData.plan;

        // Создаем описание работы для журнала
        const workDescription = type === 'fact' 
          ? `Обновлен фактический прогресс по задаче "${task}" в квартире ${floor}`
          : `Обновлен плановый прогресс по задаче "${task}" в квартире ${floor}`;

        const notes = type === 'fact'
          ? `Фактический прогресс изменен с ${currentData.fact}% на ${newValue}%`
          : `Плановый прогресс изменен с ${currentData.plan}% на ${newValue}%`;

        // Сохраняем в базу данных с автоматическим созданием записи в журнале
        const result = await upsertProgressData(
          task,
          section,
          floor,
          factProgress,
          planProgress,
          userRole, // передаем роль пользователя как updated_by
          workDescription,
          notes
        );

        if (result) {
          console.log('✅ Данные прогресса сохранены:', result);
          
          // Перезагружаем данные из базы
          await loadProgressData();
        } else {
          console.error('❌ Ошибка сохранения данных прогресса');
        }
      } catch (error) {
        console.error('❌ Ошибка при сохранении:', error);
      } finally {
        setSaving(false);
      setEditingCell(null);
      setInputValue('');
      }
    }
  };

  const handleCancel = () => {
    setEditingCell(null);
    setInputValue('');
  };

  // Функция для группировки квартир по этажам
  const getFloorGroups = () => {
    const floorGroups: { [floor: string]: string[] } = {};
    
    Object.keys(createEmptyFloorData()).forEach(apartment => {
      let floor: string;
      
      if (apartment.startsWith('T')) {
        const number = apartment.substring(1).replace(/[^0-9]/g, '');
        if (number.length === 3) {
          // T101, T201, T301, etc. -> этаж 1, 2, 3
          floor = number[0];
        } else if (number.length === 4) {
          // T1001, T1101, T1201, etc. -> этаж 10, 11, 12
          floor = number.substring(0, 2);
        } else {
          floor = number;
        }
      } else if (apartment.startsWith('У')) {
        const number = apartment.substring(1).replace(/[^0-9]/g, '');
        if (number.length === 3) {
          floor = number[0];
        } else if (number.length === 4) {
          floor = number.substring(0, 2);
        } else {
          floor = number;
        }
      } else {
        return;
      }
      
      if (!floorGroups[floor]) {
        floorGroups[floor] = [];
      }
      floorGroups[floor].push(apartment);
    });
    
    return floorGroups;
  };

  // Функция для расчета прогресса по этажу
  const calculateFloorProgress = (task: string, section: string, floor: string) => {
    const floors = progress[task]?.[section];
    if (!floors) return 0;

    const floorGroups = getFloorGroups();
    const apartmentsOnFloor = floorGroups[floor] || [];
    
    if (apartmentsOnFloor.length === 0) return 0;

    // Создаем массив значений для всех квартир на этаже (0 для отсутствующих)
    const values = apartmentsOnFloor.map(apt => {
      return floors[apt]?.fact || 0;
    });
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / values.length);
  };

  // Функция для расчета общего прогресса (по всем этажам)
  const calculateSectionTotal = (task: string, section: string) => {
    const floors = progress[task]?.[section];
    if (!floors) return 0;

    // Получаем все квартиры из системы
    const allApartments = Object.keys(createEmptyFloorData());
    
    // Создаем массив значений для всех квартир (0 для отсутствующих)
    const values = allApartments.map(apartment => {
      return floors[apartment]?.fact || 0;
    });
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / values.length);
  };

  // Фильтрация и поиск с правильной сортировкой
  const filteredTasks = useMemo(() => {
    let tasks = Object.keys(progress);
    
    if (searchTerm) {
      tasks = tasks.filter(task => 
        task.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    tasks = tasks.filter(task => {
      const taskData = progress[task];
      if (!taskData) return false;

      // Показываем работу только если в выбранной секции есть данные
      const sectionData = taskData[selectedSection];
      if (!sectionData) return false;

      return true;
    });
    
    // Сортируем по правильному порядку из TASK_ORDER
    const order = TASK_ORDER[selectedSection] || [];
    tasks.sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      // Если обе работы в списке порядка - сортируем по индексу
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // Если только одна в списке - она идет первой
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // Если обе не в списке - сортируем по алфавиту
      return a.localeCompare(b);
    });
    
    return tasks;
  }, [progress, searchTerm, selectedSection]);

  const tasks = filteredTasks;
  const sections = ['Отделочные работы', 'Работы по ОВК', 'Работы по ЭОМ+АСУ'];

  const handleAddWork = async () => {
    if (!newWorkName.trim()) return;
    try {
      setAdding(true);
      const ok = await createWorkWithZeroes(newWorkName.trim(), newWorkSection, floors);
      if (ok) {
        await loadProgressData();
        setShowAddForm(false);
        setNewWorkName('');
        // Переключаем фильтр на секцию созданной работы, чтобы её сразу видеть
        setSelectedSection(newWorkSection);
      }
    } catch (e) {
      console.error('Ошибка добавления работы:', e);
    } finally {
      setAdding(false);
    }
  };

  // Функции для навигации
  const toggleTaskExpansion = (task: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(task)) {
      newExpanded.delete(task);
    } else {
      newExpanded.add(task);
    }
    setExpandedTasks(newExpanded);
  };

  const exportToExcel = async () => {
    try {
      const csvContent = await exportProgressDataToCSV();
      
      if (csvContent) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
        a.download = `progress_table_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
        console.log('✅ Экспорт данных прогресса завершен');
      } else {
        console.error('❌ Ошибка экспорта данных прогресса');
      }
    } catch (error) {
      console.error('❌ Ошибка при экспорте:', error);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-md shadow-lg p-6">
      <div className="p-6 border-b border-white/10 rounded-t-2xl">
        <div className="flex flex-col space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/10 border border-white/10 rounded-lg flex items-center justify-center">
                <Filter className="w-4 h-4 text-slate-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Таблица прогресса работ</h2>
                <p className="text-sm text-slate-400">
                {loading ? (
                  <span className="flex items-center">
                    <Loader2 className="w-5 h-5 animate-spin mr-3" />
                    Загрузка данных...
                  </span>
                ) : (
                  `Управление ${(() => {
                    // Считаем уникальные комбинации task_name|section, исключая неправильные записи
                    const validWorks = new Set(
                      progressData
                        .filter(item => !(item.task_name === 'Гидроизоляция общая' && item.section === 'Общая'))
                        .map(item => `${item.task_name}|${item.section}`)
                    );
                    const count = validWorks.size || Object.keys(progress).reduce((total, task) => total + Object.keys(progress[task] || {}).length, 0);
                    // Если количество больше 47, показываем 47 (исправление для неправильных записей в БД)
                    return count > 47 ? 47 : count;
                  })()} работ по ${floors.length} квартирам`
                )}
              </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={exportToExcel}
                className="border border-emerald-500/30 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-6 py-3 rounded-xl flex items-center space-x-2 transition-all font-medium"
              >
                <Download className="w-5 h-5 mr-3" />
                Экспорт
              </button>
              <button
                onClick={() => setShowAddForm(v => { const next = !v; if (!v) setNewWorkSection(selectedSection as any); return next; })}
                className="border border-blue-500/30 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 px-6 py-3 rounded-xl transition-all font-medium"
              >
                Добавить работу
              </button>
              <button
                onClick={() => setShowDiagnostics(v => !v)}
                className="border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 px-4 py-3 rounded-xl transition-all"
                title="Сравнить список работ в БД и в интерфейсе"
              >
                Диагностика
              </button>
              <button
                onClick={() => setShowImporter(true)}
                className="border border-green-500/30 bg-green-500/20 hover:bg-green-500/30 text-green-200 px-4 py-3 rounded-xl transition-all flex items-center space-x-2"
                title="Импортировать данные из фотографии таблицы прогресса"
              >
                <Upload className="w-4 h-4" />
                <span>Импорт из таблицы</span>
              </button>
            </div>
          </div>
          {showAddForm && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Название работы</label>
                <input
                  type="text"
                  placeholder="Например: Шумоизоляция потолка"
                  value={newWorkName}
                  onChange={e => setNewWorkName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Секция</label>
                <select
                  value={newWorkSection}
                  onChange={e => setNewWorkSection(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                >
                  {sections.map(s => (
                    <option key={s} value={s} className="bg-slate-800 text-white">{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  onClick={handleAddWork}
                  disabled={adding || !newWorkName.trim()}
                  className={`w-full px-4 py-2 rounded-xl shadow-lg ${adding || !newWorkName.trim() ? 'bg-white/10 text-slate-500 cursor-not-allowed' : 'border border-blue-500/30 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200'}`}
                >
                  {adding ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}

          {showDiagnostics && (
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              {(() => {
                const dbWorks = Array.from(new Set(progressData.map(d => `${d.section} | ${d.task_name}`))).sort();
                const appWorks = Object.keys(progress)
                  .flatMap(task => Object.keys(progress[task] || {}).map(section => `${section} | ${task}`))
                  .sort();
                const equal = JSON.stringify(dbWorks) === JSON.stringify(appWorks);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-300">
                    <div className="md:col-span-3 font-semibold text-white">
                      Наборы работ совпадают: {equal ? 'Да' : 'Нет'}
                    </div>
                    <div>
                      <div className="font-medium mb-2">БД (progress_data)</div>
                      <ul className="list-disc pl-5 space-y-1 max-h-40 overflow-auto">
                        {dbWorks.map(w => (<li key={w}>{w}</li>))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-medium mb-2">Интерфейс (отображается)</div>
                      <ul className="list-disc pl-5 space-y-1 max-h-40 overflow-auto">
                        {appWorks.map(w => (<li key={w}>{w}</li>))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-medium mb-2">Отличия</div>
                      <ul className="list-disc pl-5 space-y-1 max-h-40 overflow-auto">
                        {[...dbWorks.filter(w => !appWorks.includes(w)).map(w => `Только в БД: ${w}`),
                          ...appWorks.filter(w => !dbWorks.includes(w)).map(w => `Только в UI: ${w}`)
                        ].map(w => (<li key={w}>{w}</li>))}
                      </ul>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Фильтры и поиск */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-800/30 border border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск работ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 focus:bg-slate-800/80"
              />
            </div>

            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-3 py-2.5 bg-slate-800/60 border border-white/10 rounded-xl text-slate-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 appearance-none cursor-pointer"
            >
              {sections.map(section => (
                <option key={section} value={section} className="bg-slate-800 text-slate-100">{section}</option>
              ))}
            </select>

            <select
              value={floorGroup}
              onChange={(e) => setFloorGroup(parseInt(e.target.value))}
              className="px-3 py-2.5 bg-slate-800/60 border border-white/10 rounded-xl text-slate-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 appearance-none cursor-pointer"
            >
              {floorGroups.map((group, index) => (
                <option key={index} value={index} className="bg-slate-800 text-slate-100">
                  Этаж {group.floorNumber} ({group.apartments.length} квартир)
                </option>
              ))}
            </select>

          </div>
        </div>
      </div>

      {/* Основная таблица */}
      <div className="overflow-x-auto rounded-b-xl bg-slate-900/30">
        <table className="min-w-full">
          <thead className="bg-slate-800/90 border-b border-white/10">
            <tr>
              <th className="sticky left-0 bg-slate-800/90 px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider z-10 min-w-[300px] border-r border-white/10">
                Работа
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider border-l border-white/10 bg-slate-800/90">
                <div className="font-semibold text-white">{selectedSection}</div>
                <div className="text-xs text-slate-400 mt-1">Этаж {currentFloorData.floorNumber} ({currentFloors.length} квартир)</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {tasks.map(task => {
              const isExpanded = expandedTasks.has(task);
              const total = calculateSectionTotal(task, selectedSection);
              const sectionData = progress[task]?.[selectedSection];
              
              return (
                <React.Fragment key={task}>
                  {/* Основная строка задачи */}
                  <tr className="hover:bg-white/5 transition-colors bg-slate-900/20">
                    <td className="sticky left-0 bg-slate-800/80 px-4 py-3 text-sm font-medium text-white z-10 border-r border-white/10">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleTaskExpansion(task)}
                          className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all duration-300"
                          title={isExpanded ? "Свернуть задачу" : "Развернуть задачу"}
                        >
                          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                        <div className="max-w-[250px] truncate" title={task}>
                          {task}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border-2 ${getCellColor(total)}`}>
                            {total}%
                          </div>
                          <div className="text-xs text-slate-400">
                            (общий)
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center border-l border-white/10 bg-slate-800/50">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="flex flex-col items-center space-y-2">
                          <div className={`inline-flex items-center px-4 py-2 rounded-xl text-lg font-bold border-2 ${getCellColor(total)}`}>
                            {total}%
                          </div>
                          <div className="text-xs text-slate-300 font-medium">
                            общий прогресс
                          </div>
                          <div className="w-20 bg-slate-700/80 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full bg-gradient-to-r ${getProgressBarColor(total)} transition-all duration-500 ease-out`}
                              style={{ width: `${total}%` }}
                            ></div>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleTaskExpansion(task)}
                          className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all duration-300"
                          title={isExpanded ? "Скрыть детали" : "Показать детали"}
                        >
                          {isExpanded ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-white/5">
                      <td colSpan={2} className="px-4 py-3 border-l border-white/10">
                        <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                          <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                            Прогресс по этажам
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {Object.keys(getFloorGroups()).sort((a, b) => parseInt(a) - parseInt(b)).map(floor => {
                              const floorProgress = calculateFloorProgress(task, selectedSection, floor);
                              const apartmentsOnFloor = getFloorGroups()[floor];
                              return (
                                <div key={floor} className="bg-white/5 rounded-xl p-3 border border-white/10 hover:bg-white/10 transition-all duration-300">
                                  <div className="text-xs font-semibold text-slate-300 mb-1">Этаж {floor}</div>
                                  <div className={`text-lg font-bold mb-2 ${getCellColor(floorProgress)}`}>
                                    {floorProgress}%
                                  </div>
                                  <div className="text-xs text-slate-500 mb-2">
                                    {apartmentsOnFloor.length} кв.
                                  </div>
                                  <div className="w-full bg-white/15 rounded-full h-2 overflow-hidden">
                                    <div 
                                      className={`h-full bg-gradient-to-r ${getProgressBarColor(floorProgress)} transition-all duration-500 ease-out`}
                                      style={{ width: `${floorProgress}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Детали по квартирам, сгруппированные по этажам */}
                        <div className="space-y-4">
                          {Object.keys(getFloorGroups()).sort((a, b) => parseInt(a) - parseInt(b)).map(floorNumber => {
                            const apartmentsOnFloor = getFloorGroups()[floorNumber];
                            const floorProgress = calculateFloorProgress(task, selectedSection, floorNumber);
                            
                            return (
                              <div key={floorNumber} className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all duration-300">
                                <div className="flex items-center justify-between mb-3">
                                  <h5 className="text-sm font-semibold text-white">
                                    Этаж {floorNumber}
                                  </h5>
                                  <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border-2 ${getCellColor(floorProgress)}`}>
                                    {floorProgress}%
                                  </div>
                                </div>
                                <div className="mb-3 w-full bg-white/15 rounded-full h-2 overflow-hidden">
                                  <div 
                                    className={`h-full bg-gradient-to-r ${getProgressBarColor(floorProgress)} transition-all duration-500 ease-out`}
                                    style={{ width: `${floorProgress}%` }}
                                  ></div>
                                </div>
                                <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
                                  {apartmentsOnFloor.map(apartment => {
                                    const apartmentData = sectionData?.[apartment] || { fact: 0, plan: 0 };
                                    
                                    const factValue = apartmentData.fact;
                                    const planValue = apartmentData.plan;
                                    
                                    return (
                                      <div key={apartment} className="bg-white/5 rounded-xl p-3 border border-white/10 hover:bg-white/10 transition-all duration-300 group">
                                        <div className="text-xs font-semibold text-slate-300 mb-2 text-center">{apartment}</div>
                                        <div className="space-y-2">
                                          {/* Факт */}
                                          <div>
                                            {editingCell?.task === task && editingCell?.section === selectedSection && editingCell?.floor === apartment && editingCell?.type === 'fact' ? (
                                              <div className="flex items-center space-x-1">
                                                <input
                                                  type="number"
                                                  value={inputValue}
                                                  onChange={handleInputChange}
                                                  className="w-full text-center border border-white/20 bg-white/5 rounded-lg text-xs p-1.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                  autoFocus
                                                  onBlur={handleSave}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSave();
                                                    if (e.key === 'Escape') handleCancel();
                                                  }}
                                                />
                                                <button 
                                                  onClick={handleSave} 
                                                  className="text-emerald-300 hover:text-emerald-200 p-1 rounded hover:bg-emerald-500/20 transition-colors"
                                                  disabled={saving}
                                                >
                                                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                </button>
                                                <button 
                                                  onClick={handleCancel} 
                                                  className="text-red-300 hover:text-red-200 p-1 rounded hover:bg-red-500/20 transition-colors"
                                                  disabled={saving}
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="relative">
                                                <div
                                                  className={`cursor-pointer hover:shadow-lg rounded-lg text-center text-xs py-2 px-1 border-2 transition-all duration-300 hover:scale-105 ${getCellColor(factValue)}`}
                                                  onClick={() => handleCellClick(task, selectedSection, apartment, 'fact', factValue)}
                                                  title={`${apartment} - факт: ${factValue}%`}
                                                >
                                                  <div className="font-bold">{factValue}%</div>
                                                  <div className="text-xs opacity-75">факт</div>
                                                </div>
                                                <div className="mt-1 w-full bg-white/15 rounded-full h-1.5 overflow-hidden">
                                                  <div 
                                                    className={`h-full bg-gradient-to-r ${getProgressBarColor(factValue)} transition-all duration-500 ease-out`}
                                                    style={{ width: `${factValue}%` }}
                                                  ></div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                          
                                          {/* План */}
                                          <div>
                                            {editingCell?.task === task && editingCell?.section === selectedSection && editingCell?.floor === apartment && editingCell?.type === 'plan' ? (
                                              <div className="flex items-center space-x-1">
                                                <input
                                                  type="number"
                                                  value={inputValue}
                                                  onChange={handleInputChange}
                                                  className="w-full text-center border border-white/20 bg-white/5 rounded-lg text-xs p-1.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                  autoFocus
                                                  onBlur={handleSave}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSave();
                                                    if (e.key === 'Escape') handleCancel();
                                                  }}
                                                />
                                                <button 
                                                  onClick={handleSave} 
                                                  className="text-emerald-300 hover:text-emerald-200 p-1 rounded hover:bg-emerald-500/20 transition-colors"
                                                  disabled={saving}
                                                >
                                                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                </button>
                                                <button 
                                                  onClick={handleCancel} 
                                                  className="text-red-300 hover:text-red-200 p-1 rounded hover:bg-red-500/20 transition-colors"
                                                  disabled={saving}
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="relative">
                                                <div
                                                  className={`cursor-pointer hover:shadow-lg rounded-lg text-center text-xs py-2 px-1 border-2 transition-all duration-300 hover:scale-105 ${getCellColor(planValue)}`}
                                                  onClick={() => handleCellClick(task, selectedSection, apartment, 'plan', planValue)}
                                                  title={`${apartment} - план: ${planValue}%`}
                                                >
                                                  <div className="font-bold">{planValue}%</div>
                                                  <div className="text-xs opacity-75">план</div>
                                                </div>
                                                {/* Прогресс-бар */}
<div className="mt-1 w-full bg-white/15 rounded-full h-1.5 overflow-hidden">
                                                    <div 
                                                      className={`h-full bg-gradient-to-r ${getProgressBarColor(planValue)} transition-all duration-500 ease-out`}
                                                      style={{ width: `${planValue}%` }}
                                                    ></div>
                                                  </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Старый способ отображения (скрыт) */}
                        <div className="hidden grid-cols-5 md:grid-cols-10 gap-2">
                          {currentFloors.map(floor => {
                            const floorData = sectionData?.[floor] || { fact: 0, plan: 0 };
                            
                            const factValue = floorData.fact;
                            const planValue = floorData.plan;
                            
                            return (
                              <div key={floor} className="bg-white rounded-lg p-2 border border-gray-200">
                                <div className="text-xs font-medium text-slate-600 mb-1">{floor}</div>
                                <div className="space-y-1">
                                  {/* Факт */}
                                  <div>
                                    {editingCell?.task === task && editingCell?.section === selectedSection && editingCell?.floor === floor && editingCell?.type === 'fact' ? (
                                      <div className="flex items-center space-x-1">
                                        <input
                                          type="number"
                                          value={inputValue}
                                          onChange={handleInputChange}
                                          className="w-full text-center border rounded text-xs p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          autoFocus
                                          onBlur={handleSave}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSave();
                                            if (e.key === 'Escape') handleCancel();
                                          }}
                                        />
                                        <button 
                                          onClick={handleSave} 
                                          className="text-green-600"
                                          disabled={saving}
                                        >
                                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                        </button>
                                        <button 
                                          onClick={handleCancel} 
                                          className="text-red-600"
                                          disabled={saving}
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        className={`cursor-pointer hover:ring-1 hover:ring-blue-300 rounded text-center text-xs py-1 ${getCellColor(factValue)}`}
                                        onClick={() => handleCellClick(task, selectedSection, floor, 'fact', factValue)}
                                        title={`${floor} - факт: ${factValue}%`}
                                      >
                                        {factValue}%
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* План */}
                                  <div>
                                    {editingCell?.task === task && editingCell?.section === selectedSection && editingCell?.floor === floor && editingCell?.type === 'plan' ? (
                                      <div className="flex items-center space-x-1">
                                        <input
                                          type="number"
                                          value={inputValue}
                                          onChange={handleInputChange}
                                          className="w-full text-center border rounded text-xs p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          autoFocus
                                          onBlur={handleSave}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSave();
                                            if (e.key === 'Escape') handleCancel();
                                          }}
                                        />
                                        <button 
                                          onClick={handleSave} 
                                          className="text-green-600"
                                          disabled={saving}
                                        >
                                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                        </button>
                                        <button 
                                          onClick={handleCancel} 
                                          className="text-red-600"
                                          disabled={saving}
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        className={`cursor-pointer hover:ring-1 hover:ring-white/20 rounded text-center text-xs py-1 ${getCellColor(planValue)}`}
                                        onClick={() => handleCellClick(task, selectedSection, floor, 'plan', planValue)}
                                        title={`${floor} - план: ${planValue}%`}
                                      >
                                        {planValue}%
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Подвал с информацией */}
      <div className="p-4 bg-white/5 border-t border-white/10 rounded-b-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-slate-400">
            <Edit className="w-4 h-4 mr-2" />
            <span>Нажмите на ячейку для редактирования • Раскройте работу для просмотра квартир</span>
          </div>
          <div className="text-xs text-slate-500">
            Показано {tasks.length} из {Object.keys(progress).length} работ • 
            Этаж {currentFloorData.floorNumber} ({currentFloors.length} квартир) из {floorGroups.length} этажей
          </div>
        </div>
      </div>

      {/* Модальное окно импорта */}
      {showImporter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)] p-6">
            <button
              type="button"
              onClick={() => setShowImporter(false)}
              className="absolute right-4 top-4 rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
            <ProgressTableImporter
              onComplete={(imported, failed) => {
                console.log(`Импорт завершен: ${imported} успешно, ${failed} ошибок`);
                // Перезагружаем данные после импорта
                if (imported > 0) {
                  loadProgressData();
                }
                // Закрываем окно через 2 секунды после успешного импорта
                if (failed === 0) {
                  setTimeout(() => setShowImporter(false), 2000);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressTable;
