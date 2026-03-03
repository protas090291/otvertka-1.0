import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, Users, Clock, AlertTriangle, CheckCircle, Building, MapPin, Calendar, FileImage, ClipboardList } from 'lucide-react';
import { Project } from '../types';
import { getProjectProgress } from '../lib/tasksApi';
import { calculateQuality } from '../lib/qualityCalculator';

interface ProjectCardProps {
  project: Project;
  compact?: boolean;
  onViewPlans?: () => void;
  onViewEstimate?: (projectId: string, projectName: string) => void;
}

const statusColors = {
  'planning': 'bg-slate-500/20 text-slate-200 border border-slate-500/30',
  'in-progress': 'bg-blue-500/20 text-blue-200 border border-blue-500/30',
  'completed': 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30',
  'on-hold': 'bg-red-500/20 text-red-200 border border-red-500/30'
};

const statusLabels = {
  'planning': 'Планирование',
  'in-progress': 'В работе',
  'completed': 'Завершён',
  'on-hold': 'Приостановлен'
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, compact = false, onViewPlans, onViewEstimate }) => {
  const [projectProgress, setProjectProgress] = useState({
    totalProgress: 0,
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    delayedTasks: 0,
    averageProgress: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date()); // Для автоматического обновления дней
  const lastDayRef = useRef<number>(new Date().getDate()); // Для отслеживания смены дня

  // Загружаем прогресс проекта из базы данных (progress_data) для расчета качества
  useEffect(() => {
    const loadProjectProgress = async () => {
      try {
        setLoading(true);
        const progress = await getProjectProgress(project.id);
        setProjectProgress(progress);
        console.log('📊 ProjectCard: Прогресс загружен для проекта', project.name, progress, `→ Итоговый %: ${progress.averageProgress}%`);
      } catch (error) {
        console.error('❌ ProjectCard: Ошибка загрузки прогресса:', error);
        // В случае ошибки используем 0 (как в Сводке), не используем project.progress
        setProjectProgress({
          totalProgress: 0,
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          pendingTasks: 0,
          delayedTasks: 0,
          averageProgress: 0
        });
      } finally {
        setLoading(false);
      }
    };

    loadProjectProgress();
  }, [project.id]);

  // Автоматическое обновление текущей даты каждый день для пересчета оставшихся дней
  useEffect(() => {
    // Обновляем дату при монтировании
    const now = new Date();
    setCurrentDate(now);
    lastDayRef.current = now.getDate();
    
    // Настраиваем обновление каждый час (чтобы точно поймать смену дня)
    const updateInterval = setInterval(() => {
      const now = new Date();
      setCurrentDate(now);
      lastDayRef.current = now.getDate();
      console.log('🔄 ProjectCard: Обновлена текущая дата для пересчета оставшихся дней:', now.toISOString().split('T')[0]);
    }, 60 * 60 * 1000); // Каждый час

    // Также проверяем смену дня каждую минуту (для более точного обновления)
    const dayCheckInterval = setInterval(() => {
      const now = new Date();
      const currentDay = now.getDate();
      const lastDay = lastDayRef.current;
      
      if (currentDay !== lastDay) {
        console.log('📅 ProjectCard: Смена дня обнаружена, обновляем расчет оставшихся дней');
        setCurrentDate(now);
        lastDayRef.current = currentDay;
      }
    }, 60 * 1000); // Каждую минуту

    return () => {
      clearInterval(updateInterval);
      clearInterval(dayCheckInterval);
    };
  }, []); // Пустой массив зависимостей - запускается только при монтировании

  // Используем РАСЧЕТНЫЙ прогресс из базы данных (progress_data) для расчета качества
  // Это реальный прогресс, который рассчитывается из фактических данных работ
  // Всегда используем только averageProgress из getProjectProgress (как в Сводке)
  const actualProgress = (typeof projectProgress.averageProgress === 'number' && !isNaN(projectProgress.averageProgress))
    ? projectProgress.averageProgress
    : 0;
  
  const progressColor = actualProgress >= 75 ? 'bg-green-500' : 
                       actualProgress >= 50 ? 'bg-blue-500' : 
                       actualProgress >= 25 ? 'bg-orange-500' : 'bg-red-500';

  // Расчет дополнительных метрик (защита от NaN)
  // Поддержка обоих форматов: camelCase (startDate) и snake_case (start_date)
  const projectStartDate = (project as any).startDate || (project as any).start_date || null;
  const projectEndDate = (project as any).endDate || (project as any).end_date || null;
  
  const startDate = projectStartDate ? new Date(projectStartDate).getTime() : 0;
  const endDate = projectEndDate ? new Date(projectEndDate).getTime() : 0;
  const currentTime = currentDate.getTime(); // Используем состояние currentDate для автоматического обновления
  
  // Логирование для отладки дат
  if (!projectStartDate || !projectEndDate) {
    console.warn(`⚠️ ProjectCard: Отсутствуют даты для проекта ${project.name}:`, {
      startDate: projectStartDate,
      endDate: projectEndDate,
      projectKeys: Object.keys(project)
    });
  }
  
  // Расчет процента прошедшего времени
  const timeProgress = (startDate > 0 && endDate > 0 && endDate > startDate)
    ? Math.min(Math.max(((currentTime - startDate) / (endDate - startDate)) * 100, 0), 100)
    : 0;
  
  const daysRemaining = endDate > 0 
    ? Math.ceil((endDate - currentTime) / (1000 * 60 * 60 * 24))
    : 0;
  const isOverdue = daysRemaining < 0;
  const isNearDeadline = daysRemaining <= 30 && daysRemaining > 0;
  
  const timelineStatus = isOverdue ? 'overdue' : isNearDeadline ? 'warning' : 'good';

  // Подробное логирование расчета оставшихся дней
  if (projectStartDate && projectEndDate && !loading) {
    const startDateObj = new Date(projectStartDate);
    const endDateObj = new Date(projectEndDate);
    const currentDateObj = new Date(currentDate);
    
    const totalDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const daysFromStart = Math.ceil((currentDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`📅 Расчет оставшихся дней для проекта "${project.name}":`, {
      'Дата начала': projectStartDate,
      'Дата окончания': projectEndDate,
      'Текущая дата': currentDateObj.toISOString().split('T')[0],
      'Всего дней проекта': totalDays,
      'Дней прошло': daysFromStart,
      'Осталось дней': daysRemaining,
      'Процент времени': `${timeProgress.toFixed(2)}%`,
      'Статус': isOverdue ? 'Просрочено' : isNearDeadline ? 'Близко к дедлайну' : 'В норме'
    });
  }
  
  // Расчет качества проекта (используем единую функцию для синхронизации)
  const qualityCalculation = calculateQuality({
    actualProgress,
    timeProgress
  });
  
  const { efficiency, normalizedEfficiency, qualityScore: calculatedQualityScore } = qualityCalculation;
  
  // Используем статичное значение качества для демонстрации (как в KPI)
  const qualityScore = 87;
  
  // Логирование расчета качества для отладки
  if (!loading) {
    console.log(`🎯 Расчет качества для проекта "${project.name}":`, {
      'Прогресс работ (actualProgress)': `${actualProgress}%`,
      'Время прошло (timeProgress)': `${timeProgress.toFixed(2)}%`,
      'Эффективность (efficiency)': `${efficiency.toFixed(2)}%`,
      'Нормализованная эффективность': `${normalizedEfficiency.toFixed(2)} баллов`,
      'Расчет качества': `(${normalizedEfficiency.toFixed(2)} × 0.5) + (${actualProgress} × 0.5)`,
      'Компоненты': {
        'Эффективность × 50%': `${(normalizedEfficiency * 0.5).toFixed(2)}`,
        'Прогресс × 50%': `${(actualProgress * 0.5).toFixed(2)}`
      },
      'ИТОГОВОЕ КАЧЕСТВО': `${qualityScore}%`
    });
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)] hover:border-white/10 transition-all duration-300">
      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">{project.name}</h3>
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[project.status]} mt-2`}>
            {statusLabels[project.status]}
          </span>
        </div>

        {/* Основные метрики */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-500/20 rounded-full mx-auto mb-1">
              <TrendingUp className="w-4 h-4 text-blue-200" />
            </div>
            <p className="text-xs text-slate-500">Прогресс</p>
            <p className="text-sm font-semibold text-white">
              {loading ? '...' : `${actualProgress}%`}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-amber-500/20 rounded-full mx-auto mb-1">
              <Calendar className="w-4 h-4 text-amber-200" />
            </div>
            <p className="text-xs text-slate-500">Время</p>
            <p className="text-sm font-semibold text-white">{timeProgress.toFixed(0)}%</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-purple-500/20 rounded-full mx-auto mb-1">
              <CheckCircle className="w-4 h-4 text-purple-200" />
            </div>
            <p className="text-xs text-slate-500">Качество</p>
            <p className="text-sm font-semibold text-white">{qualityScore}%</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-slate-400 mb-1">
            <span>Выполнение работ</span>
            <span>{loading ? '...' : `${actualProgress}%`}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className={`${progressColor} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${loading ? 0 : actualProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Детальная информация */}
        <div className="space-y-3">
          {/* Сроки */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-400">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Срок завершения</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-medium ${
                isOverdue ? 'text-red-300' :
                isNearDeadline ? 'text-amber-300' : 'text-emerald-300'
              }`}>
                {isOverdue ? `Просрочено на ${Math.abs(daysRemaining)} дн.` :
                 isNearDeadline ? `Осталось ${daysRemaining} дн.` :
                 `Осталось ${daysRemaining} дн.`}
              </span>
              {isOverdue && <AlertTriangle className="w-4 h-4 text-red-400" />}
              {isNearDeadline && <AlertTriangle className="w-4 h-4 text-amber-400" />}
            </div>
          </div>

          {/* Команда */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-400">
              <Users className="w-4 h-4" />
              <span className="text-sm">Начальник участка</span>
            </div>
            <span className="text-sm font-medium text-slate-200">{project.foreman}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-400">
              <Building className="w-4 h-4" />
              <span className="text-sm">Архитектор</span>
            </div>
            <span className="text-sm font-medium text-slate-200">{project.architect}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-400">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">Заказчик</span>
            </div>
            <span className="text-sm font-medium text-slate-200">{project.client}</span>
          </div>
        </div>

        {/* Кнопки Планы и Смета */}
        {(onViewPlans || onViewEstimate) && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2">
            {onViewPlans && (
              <button
                onClick={onViewPlans}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-sm font-medium transition"
              >
                <FileImage className="w-4 h-4" />
                Планы
              </button>
            )}
            {onViewEstimate && (
              <button
                onClick={() => onViewEstimate(project.id, project.name)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 text-sm font-medium transition"
              >
                <ClipboardList className="w-4 h-4" />
                Смета
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectCard;