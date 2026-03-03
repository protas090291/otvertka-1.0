import React, { useState, useEffect } from 'react';
import { FileText, Camera, Calendar, Download, Plus } from 'lucide-react';
import { UserRole, Report } from '../types';
import { getAllReports, createReport } from '../lib/reportsApi';
import { getAllProjects, Project } from '../lib/projectsApi';
import { getAssignableUserProfiles, getCurrentUser, UserProfile } from '../lib/authApi';

interface ReportsViewProps {
  userRole: UserRole;
}

const ReportsViewWithAPI: React.FC<ReportsViewProps> = () => {
  const [selectedType, setSelectedType] = useState('all');
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [isCreating, setIsCreating] = useState(false); // Состояние загрузки при создании отчёта
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Загружаем данные из API при монтировании компонента
  useEffect(() => {
    loadReports();
    loadUsers(); // Загружаем пользователей для определения авторов отчётов
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const apiReports = await getAllReports();

      // Приводим данные из API к фронтовому типу Report (для отображения)
      const mapped = (apiReports as any[]).map((r) => {
        let meta: any = null;
        if (typeof r.notes === 'string') {
          try {
            meta = JSON.parse(r.notes);
          } catch {
            meta = null;
          }
        }

        // Определяем имя автора: сначала из метаданных, потом из списка пользователей по ID
        let displayAuthor: string = 'Неизвестный автор';
        
        if (meta?.authorName) {
          displayAuthor = meta.authorName;
        } else if (meta?.authorId || r.created_by) {
          const authorId = meta?.authorId || r.created_by;
          const authorUser = users.find(u => u.id === authorId);
          if (authorUser) {
            displayAuthor = authorUser.full_name || authorUser.email || 'Неизвестный автор';
          }
        }

        const logicalType = meta?.logicalType as Report['type'] | undefined;

        return {
          id: r.id,
          projectId: r.project_id || r.projectId || '',
          date: r.created_at || r.date || new Date().toISOString(),
          author: displayAuthor,
          type: logicalType || ('daily' as Report['type']),
          title: r.title || '',
          description: r.description || r.content || '',
          photos: (r.photos as string[]) || [],
          attachments: (r.attachments as string[]) || []
        } as Report;
      });

      setReports(mapped);
    } catch (error) {
      console.error('Ошибка загрузки отчетов:', error);
      setNotificationMessage('Ошибка загрузки данных');
      setShowNotification(true);
    } finally {
      setLoading(false);
    }
  };

  const [reportForm, setReportForm] = useState({
    project: '',
    description: '',
    type: 'daily' as 'daily' | 'weekly' | 'milestone',
    recipient: '' // Получатель отчёта (опционально)
  });
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [foremanCreatedReports] = useState<Set<string>>(new Set());
  const [workerCreatedReports] = useState<Set<string>>(new Set());
  
  // Состояния для реальных данных
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Проверяем, заполнены ли обязательные поля
  const isFormValid = reportForm.project && reportForm.description.trim();
  const authorName =
    currentUser?.full_name ||
    currentUser?.email ||
    'Пользователь';
  
  // Загрузка проектов
  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      const projectsData = await getAllProjects();
      setProjects(projectsData);
    } catch (error) {
      console.error('Ошибка загрузки проектов:', error);
    } finally {
      setLoadingProjects(false);
    }
  };
  
  // Загрузка текущего пользователя (для имени автора и фильтрации доступа)
  useEffect(() => {
    (async () => {
      const { user } = await getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    })();
  }, []);

  // Загрузка пользователей
  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const { profiles, error } = await getAssignableUserProfiles();
      if (error) {
        console.error('Ошибка загрузки пользователей:', error);
      } else {
        setUsers(profiles || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    } finally {
      setLoadingUsers(false);
    }
  };
  
  // Перезагружаем отчёты после загрузки пользователей, чтобы обновить имена авторов
  useEffect(() => {
    if (users.length > 0) {
      loadReports();
    }
  }, [users.length]);

  // Загружаем проекты и пользователей при открытии модального окна
  useEffect(() => {
    if (isCreatingReport) {
      loadProjects();
      loadUsers();
    }
  }, [isCreatingReport]);

  // Функция для создания нового отчета
  const handleCreateReport = async () => {
    if (!isFormValid) {
      console.log('Форма не валидна:', { project: reportForm.project, description: reportForm.description });
      setNotificationMessage('Заполните все обязательные поля');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
      return;
    }

    if (!currentUser) {
      console.error('Текущий пользователь не загружен');
      setNotificationMessage('Ошибка: пользователь не загружен. Пожалуйста, обновите страницу.');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      return;
    }

    setIsCreating(true);

    try {
      const selectedProject = projects.find(p => p.id === reportForm.project);
      const selectedRecipient = reportForm.recipient ? users.find(u => u.id === reportForm.recipient) : null;
      const projectName = selectedProject?.name || 'Проект';
      const recipientName = selectedRecipient?.full_name || selectedRecipient?.email || null;

      // Формируем заголовок отчёта
      let title = `${typeLabels[reportForm.type as keyof typeof typeLabels]} отчёт - ${projectName}`;
      if (recipientName) {
        title = `Отчёт для ${recipientName} - ${projectName}`;
      }

      const newReport = {
        project_id: reportForm.project,
        title,
        description: reportForm.description,
        type: reportForm.type as 'daily' | 'weekly' | 'milestone', // Используем тип из формы
        photos: photoPreviewUrls || [], // Убеждаемся, что это массив
        content: reportForm.description,
        created_by: currentUser.id, // ID пользователя для created_by
        author: authorName, // Имя автора (обязательное поле в базе данных)
        // Метаданные для авторства и доступа
        notes: JSON.stringify({
          authorId: currentUser.id,
          authorName,
          recipientId: reportForm.recipient || null,
          recipientName: recipientName || null,
          periodType: reportForm.type
        })
      };

      console.log('Создание отчёта с данными:', newReport);
      const createdReport = await createReport(newReport);
      console.log('Отчёт создан:', createdReport);
      
      if (createdReport) {
        await loadReports(); // Перезагружаем данные
        
        // Создаём уведомление для получателя (если указан)
        if (reportForm.recipient && currentUser) {
          try {
            console.log('📤 Создание уведомления об отчёте...', {
              recipientId: reportForm.recipient,
              reportTitle: title,
              creatorId: currentUser.id
            });
            
            const { createNotification } = await import('../lib/notificationsApi');
            
            const success = await createNotification({
              type: 'report',
              title: 'Новый отчёт получен',
              message: `${authorName} создал отчёт для вас: "${title}"`,
              recipientId: reportForm.recipient,
              persistent: true, // Постоянное уведомление
              createdBy: currentUser.id
            });
            
            if (success) {
              console.log('✅ Уведомление об отчёте успешно создано');
            } else {
              console.error('❌ Не удалось создать уведомление об отчёте');
      }
    } catch (error) {
            console.error('❌ Ошибка создания уведомления об отчёте:', error);
          }
        }

        // Сброс формы
        setReportForm({
          project: '',
          description: '',
          type: 'daily',
          recipient: ''
        });
        setSelectedPhotos([]);
        setPhotoPreviewUrls([]);
        
        // Закрытие формы создания
        setIsCreatingReport(false);
        
        // Показ уведомления
        setNotificationMessage('Отчёт успешно создан!');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
      } else {
        console.error('Отчёт не был создан, createReport вернул null/undefined');
        setNotificationMessage('Ошибка: не удалось создать отчёт');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
      }
    } catch (error) {
      console.error('Ошибка создания отчета:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setNotificationMessage(`Ошибка создания отчета: ${errorMessage}`);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    } finally {
      setIsCreating(false);
    }
  };

  // Функция для сброса формы
  const handleCancelReport = () => {
    setReportForm({
      project: '',
      description: '',
      type: 'daily',
      recipient: ''
    });
    setSelectedPhotos([]);
    setPhotoPreviewUrls([]);
    setIsCreatingReport(false);
  };

  // Функция для выбора фотографий
  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newPhotos = Array.from(files);
      setSelectedPhotos(prev => [...prev, ...newPhotos]);
      
      // Создаем превью для новых фотографий
      newPhotos.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setPhotoPreviewUrls(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Функция для удаления фотографии
  const handleRemovePhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const typeColors = {
    daily: 'bg-blue-500/20 text-blue-200 border border-blue-500/30',
    weekly: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30',
    milestone: 'bg-purple-500/20 text-purple-200 border border-purple-500/30',
    warehouse: 'bg-amber-500/20 text-amber-200 border border-amber-500/30',
    technadzor: 'bg-purple-500/20 text-purple-200 border border-purple-500/30',
    contractor: 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
  };

  const typeLabels = {
    daily: 'Ежедневный',
    weekly: 'Еженедельный',
    milestone: 'Этап',
    warehouse: 'Складской',
    technadzor: 'Технадзор',
    contractor: 'Подрядчик'
  };

  // Дополнительная фильтрация: отчёт виден только постановщику (автору) и исполнителю (получателю)
  const filteredReports = reports.filter(report => {
    const anyReport = report as any;

    // Пытаемся прочитать метаданные из поля notes
    let meta: {
      authorId?: string | null;
      authorName?: string;
      recipientId?: string | null;
      recipientName?: string;
      logicalType?: string;
      periodType?: string;
    } | null = null;

    if (typeof anyReport.notes === 'string') {
      try {
        meta = JSON.parse(anyReport.notes);
      } catch {
        meta = null;
      }
    }

    const currentUserId = currentUser?.id;
    const authorId = meta?.authorId || anyReport.created_by || null;
    const recipientId = meta?.recipientId || null;

    // Если у нас есть информация об авторе/получателе и есть текущий пользователь,
    // то показываем отчёт только автору и получателю
    if (currentUserId && (authorId || recipientId)) {
      const isAuthor = authorId === currentUserId;
      const isRecipient = recipientId === currentUserId;
      if (!isAuthor && !isRecipient) {
      return false;
    }
    }

    return (
      selectedType === 'all' ||
      report.type === selectedType ||
      (selectedType === 'foreman' && foremanCreatedReports.has(report.id)) ||
      (selectedType === 'worker' && workerCreatedReports.has(report.id))
    );
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Загрузка отчетов...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Уведомление об успешном создании отчета */}
      {showNotification && (
        <div className="fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          <div className="flex items-center space-x-2">
            <span>✓</span>
            <span>{notificationMessage}</span>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Отчёты и документация</h1>
          <p className="text-slate-400 mt-1">Фото-отчёты и документооборот по проектам</p>
        </div>
        
          <div className="flex space-x-2">
          {!isCreatingReport ? (
                  <button 
                    onClick={() => setIsCreatingReport(true)}
                    className="border border-blue-500/30 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Создать отчёт</span>
                  </button>
            ) : (
              <button 
              onClick={handleCancelReport}
                className="border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
              >
                <span>Отменить</span>
              </button>
            )}
          </div>
      </div>

      {/* Filter Tabs */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)] p-4">
        <div className="flex space-x-1">
          {[
            { value: 'all', label: 'Все отчёты' },
            { value: 'daily', label: 'Ежедневные' },
            { value: 'weekly', label: 'Еженедельные' },
            { value: 'milestone', label: 'Этапы' },
            { value: 'warehouse', label: 'Складские' },
            { value: 'technadzor', label: 'Технадзор' },
            { value: 'contractor', label: 'Подрядчик' },
            { value: 'foreman', label: 'Прораб' },
            { value: 'worker', label: 'Рабочий' }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedType(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                selectedType === tab.value
                  ? 'bg-blue-500/30 text-white border border-blue-500/40'
                  : 'text-slate-300 border border-transparent hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.map((report) => (
          <div key={report.id} className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)] p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-white">{report.title}</h3>
                  {foremanCreatedReports.has(report.id) && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/30">
                      От прораба
                    </span>
                  )}
                  {workerCreatedReports.has(report.id) && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                      От рабочего
                    </span>
                  )}
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColors[report.type]}`}>
                    {typeLabels[report.type]}
                  </span>
                </div>
                
                <div className="flex items-center space-x-4 text-sm font-medium text-slate-300 mb-3">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{new Date(report.date).toLocaleDateString('ru')}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span>Автор: {report.author}</span>
                  </div>
                </div>
                
                <p className="text-base text-slate-200 leading-snug">{report.description}</p>
              </div>
              
              <button className="text-blue-300 hover:text-blue-200 p-2 rounded-xl hover:bg-blue-500/20 border border-transparent hover:border-blue-500/30 transition-colors">
                <Download className="w-5 h-5" />
              </button>
            </div>

            {/* Photos and Attachments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {report.photos && report.photos.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
                    <Camera className="w-4 h-4 text-slate-400" />
                    <span>Фотографии ({report.photos.length})</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {report.photos.map((photo, index) => (
                      <div
                        key={index}
                        className="aspect-square bg-white/10 border border-white/10 rounded-xl cursor-pointer hover:bg-white/15 transition-colors overflow-hidden"
                      >
                        {photo.startsWith('data:') ? (
                          <img 
                            src={photo} 
                            alt={`Фото ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera className="w-8 h-8 text-slate-500" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {report.attachments && report.attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span>Документы ({report.attachments.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {report.attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-3 p-3 border border-white/10 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <FileText className="w-5 h-5 text-slate-400" />
                        <span className="text-sm text-slate-200">{attachment}</span>
                        <Download className="w-4 h-4 text-slate-400 ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Форма создания обычного отчёта (модальное окно) */}
      {isCreatingReport && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)] p-6">
            <button
              type="button"
              onClick={handleCancelReport}
              className="absolute right-4 top-4 rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold text-white mb-6">Создание отчёта</h2>
        
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Проект</label>
                <select 
                  value={reportForm.project}
                  onChange={(e) => setReportForm({...reportForm, project: e.target.value})}
                    disabled={loadingProjects}
                    className="w-full px-3 py-2 border border-white/10 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" className="bg-slate-800 text-white">{loadingProjects ? 'Загрузка проектов...' : 'Выберите проект'}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id} className="bg-slate-800 text-white">
                        {project.name}
                      </option>
                    ))}
                </select>
              </div>
              
              <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Получатель отчёта (необязательно)</label>
                  <select 
                    value={reportForm.recipient}
                    onChange={(e) => setReportForm({...reportForm, recipient: e.target.value})}
                    disabled={loadingUsers}
                    className="w-full px-3 py-2 border border-white/10 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" className="bg-slate-800 text-white">{loadingUsers ? 'Загрузка пользователей...' : 'Не выбран (отчёт для всех)'}</option>
                    {users.length === 0 && !loadingUsers && (
                      <option value="" disabled className="bg-slate-800 text-white">Нет доступных пользователей</option>
                    )}
                    {users.map((user) => (
                      <option key={user.id} value={user.id} className="bg-slate-800 text-white">
                        {user.full_name || user.email}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Тип отчёта</label>
                <select 
                  value={reportForm.type}
                    onChange={(e) => setReportForm({...reportForm, type: e.target.value as 'daily' | 'weekly' | 'milestone'})}
                    className="w-full px-3 py-2 border border-white/10 rounded-lg bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                >
                  <option value="daily" className="bg-slate-800 text-white">Ежедневный</option>
                  <option value="weekly" className="bg-slate-800 text-white">Еженедельный</option>
                  <option value="milestone" className="bg-slate-800 text-white">Этап</option>
                </select>
              </div>
            
              <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Описание работ</label>
                <textarea
                  value={reportForm.description}
                  onChange={(e) => setReportForm({...reportForm, description: e.target.value})}
                  placeholder="Опишите выполненные работы..."
                  rows={3}
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-slate-900/60 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                ></textarea>
              </div>
              
              <div className="flex space-x-2">
                <label 
                    className={`flex-1 py-2 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer font-medium ${
                    isFormValid 
                        ? 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white shadow-md hover:shadow-lg' 
                        : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Добавить фото</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    disabled={!isFormValid}
                    className="hidden"
                  />
                </label>
                <button 
                    disabled={!isFormValid || isCreating}
                  onClick={handleCreateReport}
                    className={`flex-1 py-2 rounded-lg transition-colors font-semibold ${
                      isFormValid && !isCreating
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl' 
                        : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isCreating ? 'Создание...' : 'Создать отчёт'}
                </button>
              </div>
            </div>
            
              <div className={`border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
              isFormValid 
                  ? 'border-blue-500/60 hover:border-blue-500 bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-slate-900/40 hover:from-blue-500/30 hover:via-blue-500/20' 
                  : 'border-slate-700/50 bg-slate-900/60'
            }`}>
              {selectedPhotos.length > 0 ? (
                <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Выбранные фотографии ({selectedPhotos.length})</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {photoPreviewUrls.map((url, index) => (
                      <div key={index} className="relative">
                        <img 
                          src={url} 
                          alt={`Фото ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-700"
                        />
                        <button
                          onClick={() => handleRemovePhoto(index)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="mt-3 block text-center">
                      <span className="text-blue-400 hover:text-blue-300 text-sm cursor-pointer">
                      Добавить ещё фото
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="text-center">
                  <Camera className={`w-12 h-12 mx-auto mb-2 ${
                      isFormValid ? 'text-blue-400' : 'text-gray-600'
                  }`} />
                  {isFormValid ? (
                    <>
                        <p className="text-blue-300 font-medium">Нажмите «Добавить фото» для выбора</p>
                        <p className="text-xs text-blue-400 mt-1">PNG, JPG до 10MB</p>
                    </>
                  ) : (
                    <>
                        <p className="text-slate-400">Область загрузки файлов</p>
                        <p className="text-xs text-slate-500 mt-1">Сначала заполните информацию об отчёте</p>
                    </>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}


      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Отчёты не найдены</p>
          <p className="text-slate-500 mt-2">Создайте первый отчёт для отслеживания прогресса</p>
        </div>
      )}
    </div>
  );
};

export default ReportsViewWithAPI;
