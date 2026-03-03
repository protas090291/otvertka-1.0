import React, { useState, useEffect } from 'react';
import { Plus, Filter, Search, FileImage } from 'lucide-react';
import { UserRole, Project } from '../types';
import ProjectCard from './ProjectCard';
import { getAllProjects, createProject, ProjectInput } from '../lib/projectsApi';

interface ProjectsViewWithAPIProps {
  userRole: UserRole;
  onNavigateToPlans?: () => void;
  onNavigateToEstimate?: (projectId: string, projectName: string) => void;
}

const ProjectsViewWithAPI: React.FC<ProjectsViewWithAPIProps> = ({ userRole, onNavigateToPlans, onNavigateToEstimate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectInput>({
    name: '',
    description: '',
    address: '',
    status: 'planning',
    start_date: '',
    end_date: '',
    total_budget: 0,
    client: '',
    foreman: '',
    architect: ''
  });

  // Загрузка проектов при монтировании компонента
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedProjects = await getAllProjects();
      
      // Проверяем, есть ли проект "Вишневый сад" в базе
      const hasVishnevyySad = fetchedProjects.some((p: any) => {
        const id = (p.id || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        return id === 'zhk-vishnevyy-sad' || 
               name.includes('вишневый сад') || 
               name.includes('вишнёвый сад');
      });
      
      // Статические данные для проекта "Вишневый сад" (синхронизированы со сводкой)
      const staticVishnevyySad = {
        id: 'zhk-vishnevyy-sad',
        name: 'ЖК "Вишневый сад"',
        status: 'in-progress',
        progress: 65, // Синхронизировано со сводкой
        startDate: '2025-06-20', // Синхронизировано со сводкой
        endDate: '2026-06-20', // Синхронизировано со сводкой
        budget: 180000000, // Синхронизировано со сводкой
        spent: 117000000, // Синхронизировано со сводкой
        client: 'ООО "АБ ДЕВЕЛОПМЕНТ ЦЕНТР"',
        foreman: 'Саидов Ю.Н.',
        contractor: 'ООО "СтройМонтаж"',
        architect: 'Петров П.П.',
        description: 'Строительство жилого комплекса',
        start_date: '2025-06-20',
        end_date: '2026-06-20',
        total_budget: 180000000,
        address: 'ул. Вишневая, 15'
      };
      
      const mappedProjects = (fetchedProjects || [])
        .filter((project: any) => {
          // Исключаем проект "Вишневый сад" из базы, если он там есть
          const id = (project.id || '').toLowerCase();
          const name = (project.name || '').toLowerCase();
          return id !== 'zhk-vishnevyy-sad' && 
                 !name.includes('вишневый сад') &&
                 !name.includes('вишнёвый сад');
        })
        .map((project: any) => ({
          id: project.id,
          name: project.name,
          status: project.status,
          progress: project.progress || 0,
          startDate: project.start_date || project.startDate || '',
          endDate: project.end_date || project.endDate || '',
          budget: project.total_budget || project.budget || 0,
          spent: project.spent || 0,
          client: project.client || '',
          foreman: project.foreman || '',
          architect: project.architect || '',
          description: project.description || '',
          start_date: project.start_date,
          end_date: project.end_date,
          total_budget: project.total_budget,
          address: project.address || ''
        }));

      // Добавляем статический проект "Вишневый сад" в начало списка
      setProjects([staticVishnevyySad, ...mappedProjects]);
      
      if (mappedProjects.length === 0 && !hasVishnevyySad) {
        setError('В Supabase пока нет проектов. Создайте первый проект, чтобы начать работу.');
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
      setError('Не удалось загрузить проекты из Supabase. Проверьте подключение и попробуйте снова.');
      setNotificationMessage('Ошибка загрузки проектов');
      setShowNotification(true);
    } finally {
      setLoading(false);
    }
  };
  const handleCreateProject = async () => {
    if (!projectForm.name || !projectForm.start_date || !projectForm.end_date || !projectForm.client || !projectForm.foreman || !projectForm.architect) {
      setNotificationMessage('Пожалуйста, заполните все обязательные поля');
      setShowNotification(true);
      return;
    }

    try {
      const createdProject = await createProject(projectForm);
      if (createdProject) {
        // Маппинг созданного проекта в формат компонента
        const mappedProject: any = {
          id: createdProject.id,
          name: createdProject.name,
          status: createdProject.status,
          progress: createdProject.progress || 0,
          startDate: createdProject.start_date,
          endDate: createdProject.end_date,
          budget: createdProject.total_budget || 0,
          spent: createdProject.spent || 0,
          client: createdProject.client || '',
          foreman: createdProject.foreman || '',
          architect: createdProject.architect || '',
          description: createdProject.description || '',
          start_date: createdProject.start_date,
          end_date: createdProject.end_date,
          total_budget: createdProject.total_budget,
          address: createdProject.address || ''
        };
        setProjects(prevProjects => [mappedProject, ...prevProjects]);
        setNotificationMessage('Проект успешно создан!');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
        
        // Сброс формы
        setProjectForm({
          name: '',
          description: '',
          address: '',
          status: 'planning',
          start_date: '',
          end_date: '',
          total_budget: 0,
          client: '',
          foreman: '',
          architect: ''
        });
        setIsCreatingProject(false);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      setNotificationMessage('Ошибка создания проекта');
      setShowNotification(true);
    }
  };

  const handleCancelCreateProject = () => {
    setProjectForm({
      name: '',
      description: '',
      address: '',
      status: 'planning',
      start_date: '',
      end_date: '',
      total_budget: 0,
      client: '',
      foreman: '',
      architect: ''
    });
    setIsCreatingProject(false);
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center h-64 space-y-3 rounded-3xl border border-white/10 bg-white/5 text-center text-white">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          <p className="text-lg font-medium">Загружаем проекты из Supabase…</p>
          <p className="text-sm text-slate-300">Это может занять несколько секунд</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center h-64 space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 text-center text-white">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          <p className="text-lg font-medium">Загружаем проекты…</p>
          <p className="text-sm text-slate-400">Это может занять несколько секунд</p>
        </div>
      </div>
    );
  }

  const cardClass = 'rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)]';
  const inputClass = 'w-full px-3 py-2 border border-white/10 rounded-xl bg-white/5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50';

  return (
    <div className="space-y-6">
      {showNotification && (
        <div className="fixed top-20 right-4 bg-emerald-500/90 text-white px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in border border-emerald-400/30">
          <div className="flex items-center space-x-2">
            <span>✓</span>
            <span>{notificationMessage}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Проекты</h1>
          <p className="text-slate-400 mt-1">Управление строительными проектами</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={onNavigateToPlans}
            className="border border-emerald-500/30 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
          >
            <FileImage className="w-4 h-4" />
            <span>Архитектурные планы</span>
          </button>
          {(userRole === 'foreman' || userRole === 'client' || userRole === 'storekeeper') && (
            <button
              onClick={() => setIsCreatingProject(true)}
              className="border border-blue-500/30 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Новый проект</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/15 border border-red-500/30 text-red-200 px-4 py-3 rounded-2xl flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold">Проблема с загрузкой данных</p>
            <p className="text-sm text-red-100">{error}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadProjects}
              className="px-3 py-1.5 rounded-xl border border-red-300/60 text-sm hover:bg-red-500/20 transition"
            >
              Повторить загрузку
            </button>
            {projects.length === 0 && (
              <button
                onClick={() => setIsCreatingProject(true)}
                className="px-3 py-1.5 rounded-xl border border-white/30 text-sm text-white hover:bg-white/10 transition"
              >
                Создать проект
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`${cardClass} p-6`}>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск проектов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${inputClass} px-3 py-2`}
            >
              <option value="all" className="bg-slate-800 text-white">Все статусы</option>
              <option value="planning" className="bg-slate-800 text-white">Планирование</option>
              <option value="in-progress" className="bg-slate-800 text-white">В работе</option>
              <option value="completed" className="bg-slate-800 text-white">Завершён</option>
              <option value="on-hold" className="bg-slate-800 text-white">Приостановлен</option>
            </select>
          </div>
        </div>
      </div>

      {/* Форма создания проекта */}
      {isCreatingProject && (
        <div className="bg-white/40 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Создание нового проекта</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Название проекта *</label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({...projectForm, name: e.target.value})}
                  placeholder="Введите название проекта"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Статус</label>
                <select 
                  value={projectForm.status}
                  onChange={(e) => setProjectForm({...projectForm, status: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="planning">Планирование</option>
                  <option value="in-progress">В работе</option>
                  <option value="completed">Завершён</option>
                  <option value="on-hold">Приостановлен</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Дата начала *</label>
                <input
                  type="date"
                  value={projectForm.start_date}
                  onChange={(e) => setProjectForm({...projectForm, start_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Дата окончания *</label>
                <input
                  type="date"
                  value={projectForm.end_date}
                  onChange={(e) => setProjectForm({...projectForm, end_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Бюджет (руб.)</label>
                <input
                  type="number"
                  value={projectForm.total_budget}
                  onChange={(e) => setProjectForm({...projectForm, total_budget: parseInt(e.target.value) || 0})}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Заказчик *</label>
                <input
                  type="text"
                  value={projectForm.client}
                  onChange={(e) => setProjectForm({...projectForm, client: e.target.value})}
                  placeholder="Введите название заказчика"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Прораб *</label>
                <input
                  type="text"
                  value={projectForm.foreman}
                  onChange={(e) => setProjectForm({...projectForm, foreman: e.target.value})}
                  placeholder="Введите ФИО прораба"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Архитектор *</label>
                <input
                  type="text"
                  value={projectForm.architect}
                  onChange={(e) => setProjectForm({...projectForm, architect: e.target.value})}
                  placeholder="Введите ФИО архитектора"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Описание</label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({...projectForm, description: e.target.value})}
                  placeholder="Описание проекта..."
                  rows={4}
                  className={`${inputClass} resize-none`}
                ></textarea>
              </div>
              
              <div className="flex space-x-2 pt-4">
                <button 
                  onClick={handleCreateProject}
                  className="flex-1 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 transition-colors"
                >
                  Создать проект
                </button>
                <button
                  onClick={handleCancelCreateProject}
                  className="flex-1 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onViewPlans={onNavigateToPlans}
            onViewEstimate={onNavigateToEstimate}
          />
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12 space-y-3 border border-dashed border-white/20 rounded-3xl bg-white/5">
          <div className="w-12 h-12 mx-auto rounded-full bg-white/10 flex items-center justify-center">
            <FileImage className="w-6 h-6 text-white/80" />
          </div>
          <p className="text-gray-100 text-lg font-semibold">{error ? 'Не удалось загрузить данные' : 'Проекты не найдены'}</p>
          <p className="text-gray-400">
            {error ? 'Проверьте подключение к Supabase и попробуйте ещё раз.' : 'Попробуйте изменить параметры поиска или создайте новый проект.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={loadProjects}
              className="px-4 py-2 rounded-xl border border-white/20 text-sm text-white hover:bg-white/10 transition"
            >
              Обновить
            </button>
            <button
              onClick={() => setIsCreatingProject(true)}
              className="px-4 py-2 rounded-xl border border-blue-400/40 text-sm text-blue-200 hover:bg-blue-500/10 transition"
            >
              Создать проект
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsViewWithAPI;