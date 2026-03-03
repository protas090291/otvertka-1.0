import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Building, 
  FileText, 
  TrendingUp, 
  Filter,
  Download,
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { WorkJournalEntry, WorkJournalStats } from '../types';
import { 
  getAllWorkJournalEntries,
  getWorkJournalEntriesByDateRange,
  getTodayWorkJournalEntries,
  getYesterdayWorkJournalEntries,
  getThisWeekWorkJournalEntries,
  getWorkJournalStats,
  exportWorkJournalToCSV,
  deleteWorkJournalEntry
} from '../lib/workJournalApi';
import AddWorkJournalEntry from './AddWorkJournalEntry';
import DateRangePicker from './DateRangePicker';

interface WorkJournalProps {
  userRole: string;
}

const WorkJournal: React.FC<WorkJournalProps> = ({ userRole }) => {
  const [entries, setEntries] = useState<WorkJournalEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<WorkJournalEntry[]>([]);
  const [stats, setStats] = useState<WorkJournalStats>({
    total_works: 0,
    total_progress_gained: 0,
    unique_workers: 0,
    unique_tasks: 0,
    unique_apartments: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string | null>(null);
  const [customEndDate, setCustomEndDate] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState('');
  const [apartmentFilter, setApartmentFilter] = useState('');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Загрузка данных
  useEffect(() => {
    loadWorkJournalData();
  }, []);

  // Фильтрация данных
  useEffect(() => {
    filterEntries();
  }, [entries, searchTerm, dateFilter, taskFilter, apartmentFilter, customStartDate, customEndDate]);

  // Функция для проверки, является ли день рабочим (пн-пт)
  const isWorkday = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // 1 = понедельник, 5 = пятница
  };

  // Функция для поиска последнего рабочего дня
  const getLastWorkday = (fromDate: Date): string => {
    let currentDate = new Date(fromDate);
    currentDate.setDate(currentDate.getDate() - 1); // Начинаем с вчера
    
    // Ищем последний рабочий день (максимум 7 дней назад)
    for (let i = 0; i < 7; i++) {
      if (isWorkday(currentDate)) {
        return currentDate.toISOString().split('T')[0];
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    // Если не нашли рабочий день за неделю, возвращаем вчера
    return new Date(fromDate).toISOString().split('T')[0];
  };

  // Локальная функция для расчета статистики с учетом рабочих дней
  const calculateLocalStats = (entriesData: WorkJournalEntry[]) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Определяем, нужно ли учитывать сегодняшний день
    const shouldCountToday = isWorkday(today);
    
    // Находим последний рабочий день
    const lastWorkdayStr = getLastWorkday(today);
    
    // Подсчитываем количество работ
    const todayWorks = shouldCountToday ? entriesData.filter(entry => entry.work_date === todayStr).length : 0;
    const lastWorkdayWorks = entriesData.filter(entry => entry.work_date === lastWorkdayStr).length;

    // Рассчитываем прирост по новой формуле
    let dailyGrowth = 0;
    if (lastWorkdayWorks === 0) {
      dailyGrowth = todayWorks > 0 ? 100 : 0;
    } else {
      dailyGrowth = Math.round(((todayWorks / lastWorkdayWorks) * 100 - 100));
    }

    // Подсчитываем уникальные значения
    const uniqueWorkers = new Set(entriesData.map(entry => entry.worker_name).filter(Boolean)).size;
    const uniqueTasks = new Set(entriesData.map(entry => entry.task_name)).size;
    const uniqueApartments = new Set(entriesData.map(entry => entry.apartment_id)).size;

    return {
      total_works: entriesData.length,
      total_progress_gained: dailyGrowth,
      unique_workers: uniqueWorkers,
      unique_tasks: uniqueTasks,
      unique_apartments: uniqueApartments
    };
  };

  const loadWorkJournalData = async () => {
    try {
      setLoading(true);
      const entriesData = await getAllWorkJournalEntries();
      const statsData = calculateLocalStats(entriesData);
      setEntries(entriesData);
      setStats(statsData);
    } catch (error) {
      console.error('Ошибка загрузки журнала работ:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkJournalDataByDateRange = async (startDate: string, endDate: string) => {
    try {
      setLoading(true);
      const entriesData = await getWorkJournalEntriesByDateRange(startDate, endDate);
      const statsData = calculateLocalStats(entriesData);
      setEntries(entriesData);
      setStats(statsData);
    } catch (error) {
      console.error('Ошибка загрузки журнала работ по периоду:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterEntries = () => {
    let filtered = [...entries];

    // Фильтр по дате
    if (dateFilter !== 'all') {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(entry => entry.work_date === today);
          break;
        case 'yesterday':
          filtered = filtered.filter(entry => entry.work_date === yesterdayStr);
          break;
        case 'week':
          const startOfWeek = new Date();
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
          const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
          filtered = filtered.filter(entry => entry.work_date >= startOfWeekStr);
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            filtered = filtered.filter(entry => 
              entry.work_date >= customStartDate && entry.work_date <= customEndDate
            );
          } else if (customStartDate) {
            filtered = filtered.filter(entry => entry.work_date >= customStartDate);
          } else if (customEndDate) {
            filtered = filtered.filter(entry => entry.work_date <= customEndDate);
          }
          break;
      }
    }

    // Фильтр по поиску
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.task_name.toLowerCase().includes(term) ||
        entry.work_description.toLowerCase().includes(term) ||
        entry.apartment_id.toLowerCase().includes(term) ||
        entry.worker_name?.toLowerCase().includes(term) ||
        entry.notes?.toLowerCase().includes(term)
      );
    }

    // Фильтр по задаче
    if (taskFilter) {
      filtered = filtered.filter(entry => entry.task_name === taskFilter);
    }

    // Фильтр по квартире
    if (apartmentFilter) {
      filtered = filtered.filter(entry => entry.apartment_id === apartmentFilter);
    }

    setFilteredEntries(filtered);
  };

  const handleDeleteEntry = async (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить эту запись?')) {
      const success = await deleteWorkJournalEntry(id);
      if (success) {
        setEntries(entries.filter(entry => entry.id !== id));
      }
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = await exportWorkJournalToCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `work_journal_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Ошибка экспорта CSV:', error);
    }
  };

  const toggleEntryExpansion = (id: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEntries(newExpanded);
  };

  const getUniqueTasks = () => {
    return [...new Set(entries.map(entry => entry.task_name))].sort();
  };

  const getUniqueApartments = () => {
    return [...new Set(entries.map(entry => entry.apartment_id))].sort();
  };

  const handleDateRangeChange = (startDate: string | null, endDate: string | null) => {
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
    if (startDate || endDate) {
      setDateFilter('custom');
      // Загружаем данные с сервера для выбранного периода
      if (startDate && endDate) {
        loadWorkJournalDataByDateRange(startDate, endDate);
      } else {
        // Если выбран только один конец диапазона, загружаем все данные и фильтруем локально
        loadWorkJournalData();
      }
    }
  };

  const handleDateFilterChange = (filter: string) => {
    setDateFilter(filter as any);
    if (filter !== 'custom') {
      setCustomStartDate(null);
      setCustomEndDate(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  const cardClass = 'rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)]';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white"></div>
        <span className="ml-2 text-slate-400">Загрузка журнала работ...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Журнал работ</h1>
          <p className="text-slate-400 mt-1">История изменений в таблице прогресса</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="border border-emerald-500/30 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-6 py-3 rounded-xl flex items-center space-x-2 transition-all font-medium"
        >
          <Download className="w-4 h-4" />
          <span>Экспорт CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-stretch">
        <div className={`${cardClass} p-6 flex flex-col min-h-[120px]`}>
          <div className="flex items-start justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-slate-400">Изменений</p>
            <div className="p-3 rounded-xl bg-blue-500/20 flex-shrink-0">
              <FileText className="w-6 h-6 text-blue-200" />
            </div>
          </div>
          <div className="flex-1 min-h-0" />
          <p className="text-2xl font-bold text-white flex-shrink-0">{stats.total_works}</p>
          <div className="w-full h-1 bg-blue-500/50 rounded-full flex-shrink-0 pt-3" />
        </div>
        <div className={`${cardClass} p-6 flex flex-col min-h-[120px]`}>
          <div className="flex items-start justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-slate-400">Прирост за день</p>
            <div className={`p-3 rounded-xl flex-shrink-0 ${stats.total_progress_gained >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              {stats.total_progress_gained >= 0 ? (
                <TrendingUp className="w-6 h-6 text-emerald-200" />
              ) : (
                <TrendingUp className="w-6 h-6 text-red-200 rotate-180" />
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0" />
          <p className={`text-2xl font-bold flex-shrink-0 ${stats.total_progress_gained >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {stats.total_progress_gained >= 0 ? '+' : ''}{stats.total_progress_gained}%
          </p>
          <div className={`w-full h-1 rounded-full flex-shrink-0 pt-3 ${stats.total_progress_gained >= 0 ? 'bg-emerald-500/50' : 'bg-red-500/50'}`} />
        </div>
        <div className={`${cardClass} p-6 flex flex-col min-h-[120px]`}>
          <div className="flex items-start justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-slate-400">Исполнителей</p>
            <div className="p-3 rounded-xl bg-blue-500/20 flex-shrink-0">
              <User className="w-6 h-6 text-blue-200" />
            </div>
          </div>
          <div className="flex-1 min-h-0" />
          <p className="text-2xl font-bold text-white flex-shrink-0">{stats.unique_workers}</p>
          <div className="w-full h-1 bg-blue-500/50 rounded-full flex-shrink-0 pt-3" />
        </div>
        <div className={`${cardClass} p-6 flex flex-col min-h-[120px]`}>
          <div className="flex items-start justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-slate-400">Квартир</p>
            <div className="p-3 rounded-xl bg-amber-500/20 flex-shrink-0">
              <Building className="w-6 h-6 text-amber-200" />
            </div>
          </div>
          <div className="flex-1 min-h-0" />
          <p className="text-2xl font-bold text-white flex-shrink-0">{stats.unique_apartments}</p>
          <div className="w-full h-1 bg-amber-500/50 rounded-full flex-shrink-0 pt-3" />
        </div>
        <div className={`${cardClass} p-6 flex flex-col min-h-[120px]`}>
          <div className="flex items-start justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-slate-400">Задач</p>
            <div className="p-3 rounded-xl bg-red-500/20 flex-shrink-0">
              <FileText className="w-6 h-6 text-red-200" />
            </div>
          </div>
          <div className="flex-1 min-h-0" />
          <p className="text-2xl font-bold text-white flex-shrink-0">{stats.unique_tasks}</p>
          <div className="w-full h-1 bg-red-500/50 rounded-full flex-shrink-0 pt-3" />
        </div>
      </div>

      <div className={`${cardClass} p-6`}>
        <div className="space-y-4">
          {/* Первая строка фильтров */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Поиск */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Поиск по работам..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30"
              />
            </div>

            {/* Фильтр по задаче */}
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30"
            >
              <option value="" className="bg-slate-800 text-white">Все задачи</option>
              {getUniqueTasks().map(task => (
                <option key={task} value={task} className="bg-slate-800 text-white">{task}</option>
              ))}
            </select>

            {/* Фильтр по квартире */}
            <select
              value={apartmentFilter}
              onChange={(e) => setApartmentFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="" className="bg-slate-800 text-white">Все квартиры</option>
              {getUniqueApartments().map(apartment => (
                <option key={apartment} value={apartment} className="bg-slate-800 text-white">{apartment}</option>
              ))}
            </select>
          </div>

          {/* Вторая строка - фильтры по дате */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Быстрые фильтры по дате */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleDateFilterChange('all')}
                className={`px-3 py-1 text-sm rounded-full border transition-all duration-200 ${
                  dateFilter === 'all' 
                    ? 'bg-blue-500/30 text-white border-blue-500/50' 
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                Все даты
              </button>
              <button
                onClick={() => handleDateFilterChange('today')}
                className={`px-3 py-1 text-sm rounded-full border transition-all duration-200 ${
                  dateFilter === 'today'
                    ? 'bg-blue-500/30 text-white border-blue-500/50'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                Сегодня
              </button>
              <button
                onClick={() => handleDateFilterChange('yesterday')}
                className={`px-3 py-1 text-sm rounded-full border transition-all duration-200 ${
                  dateFilter === 'yesterday' 
                    ? 'bg-blue-500/30 text-white border-blue-500/50' 
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                Вчера
              </button>
              <button
                onClick={() => handleDateFilterChange('week')}
                className={`px-3 py-1 text-sm rounded-full border transition-all duration-200 ${
                  dateFilter === 'week' 
                    ? 'bg-blue-500/30 text-white border-blue-500/50' 
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                Эта неделя
              </button>
            </div>

            {/* Календарь для выбора периода */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-slate-300 whitespace-nowrap">Период:</span>
              <DateRangePicker
                startDate={customStartDate}
                endDate={customEndDate}
                onDateRangeChange={handleDateRangeChange}
                placeholder="Выберите период"
                className="flex-1"
              />
              <button
                onClick={() => {
                  setDateFilter('all');
                  setCustomStartDate(null);
                  setCustomEndDate(null);
                  setSearchTerm('');
                  setTaskFilter('');
                  setApartmentFilter('');
                  loadWorkJournalData();
                }}
                className="px-3 py-1 text-sm bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 transition-all duration-200"
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">
            История изменений прогресса ({filteredEntries.length})
          </h3>
        </div>
        <div className="divide-y divide-white/10">
          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Изменения в таблице прогресса не найдены</h3>
              <p className="text-sm">Начните редактировать прогресс в таблице, чтобы увидеть историю изменений</p>
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-white/5 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => toggleEntryExpansion(entry.id)}
                        className="text-slate-400 hover:text-white"
                      >
                        {expandedEntries.has(entry.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-white text-base">{entry.task_name}</h4>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-200 border border-blue-500/30 rounded-lg">
                            {entry.section}
                          </span>
                        </div>
                        <p className="text-base text-slate-200 mt-1 leading-snug">{entry.work_description}</p>
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-300 font-medium">
                          <div className="flex items-center text-slate-200">
                            <Building className="w-4 h-4 mr-1.5 text-slate-400 shrink-0" />
                            {entry.apartment_id}
                          </div>
                          <div className="flex items-center text-slate-200">
                            <Calendar className="w-4 h-4 mr-1.5 text-slate-400 shrink-0" />
                            {formatDate(entry.work_date)}
                          </div>
                          <div className="flex items-center text-slate-200">
                            <Clock className="w-4 h-4 mr-1.5 text-slate-400 shrink-0" />
                            {formatTime(entry.work_time)}
                          </div>
                          {entry.worker_name && (
                            <div className="flex items-center text-slate-200">
                              <User className="w-4 h-4 mr-1.5 text-slate-400 shrink-0" />
                              {entry.worker_name}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-slate-300">{entry.progress_before}%</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-sm font-semibold text-emerald-300">{entry.progress_after}%</span>
                        </div>
                        <div className="text-sm text-slate-400 font-medium">
                          +{entry.progress_after - entry.progress_before}%
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {(userRole === 'contractor' || userRole === 'foreman') && (
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-2 text-red-300 hover:bg-red-500/20 rounded-lg transition-all duration-200"
                        title="Удалить запись"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Развернутая информация */}
                {expandedEntries.has(entry.id) && (
                  <div className="mt-4 pl-6 border-l-2 border-white/10 bg-white/5 rounded-r-xl p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium text-white mb-2">Детали изменения</h5>
                        <p className="text-base text-slate-200 leading-snug">{entry.work_description}</p>
                        {entry.notes && (
                          <div className="mt-2">
                            <h6 className="font-medium text-slate-300">Заметки</h6>
                            <p className="text-base text-slate-200 mt-0.5">{entry.notes}</p>
                          </div>
                        )}
                      </div>
                      <div>
                        <h5 className="font-medium text-white mb-2">Информация об исполнителе</h5>
                        <div className="space-y-1 text-base text-slate-200">
                          <div><span className="font-medium">Имя:</span> {entry.worker_name || 'Не указано'}</div>
                          <div><span className="font-medium">Роль:</span> {entry.worker_role || 'Не указано'}</div>
                          <div><span className="font-medium">Дата:</span> {formatDate(entry.work_date)}</div>
                          <div><span className="font-medium">Время:</span> {formatTime(entry.work_time)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkJournal;
