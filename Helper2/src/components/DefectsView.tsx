import React, { useState } from 'react';
import {
  AlertTriangle, Camera, Video, MapPin, Calendar, User, DollarSign, MessageSquare, Filter, Search, CheckCircle, Clock, XCircle, Building, Eye
} from 'lucide-react';
import { UserRole, Defect, DefectComment, SupabaseDefect } from '../types';
import { supabaseAdmin } from '../lib/supabase';
import PlanWithMarks from './PlanWithMarks';
import PlanWithSupabaseDefects from './PlanWithSupabaseDefects';
import { useDefectsCount } from '../hooks/useDefectsCount';
import { getAllDefects, updateDefectStatus, createDefect, getCurrentMode } from '../lib/hybridDefectsApi';
import { getCurrentUser } from '../lib/authApi';
import DefectStatusChanger from './DefectStatusChanger';

interface DefectsViewProps {
  userRole: UserRole;
}

const DefectsView: React.FC<DefectsViewProps> = ({ userRole }) => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingDefect, setIsCreatingDefect] = useState(false);
  const [defectForm, setDefectForm] = useState({
    project: '',
    apartment: '',
    title: '',
    description: '',
    location: '',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    category: 'other' as 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'safety' | 'other',
    assignedTo: '',
    apartmentNumber: '',
    planMark: undefined as any
  });
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [statusChanged, setStatusChanged] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentPhotos, setCommentPhotos] = useState<File[]>([]);
  const [commentPhotoUrls, setCommentPhotoUrls] = useState<string[]>([]);
  const [replyingToDefect, setReplyingToDefect] = useState<string | null>(null);
  const [takenToWork, setTakenToWork] = useState<string | null>(null);
  const [viewingDefect, setViewingDefect] = useState<string | null>(null);
  const [resolvedDefect, setResolvedDefect] = useState<string | null>(null);
  const [editingDefect, setEditingDefect] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    status: 'open' as 'open' | 'in-progress' | 'resolved' | 'closed',
    assignedTo: ''
  });
  const [isCreatingClientDefect, setIsCreatingClientDefect] = useState(false);
  const [clientDefectForm, setClientDefectForm] = useState({
    project: '',
    apartment: '',
    title: '',
    description: '',
    location: '',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    category: 'other' as 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'safety' | 'other',
    assignedTo: ''
  });
  const [clientCreatedDefects, setClientCreatedDefects] = useState<Set<string>>(new Set());
  const [transferringDefect, setTransferringDefect] = useState<string | null>(null);
  const [transferForm, setTransferForm] = useState({
    foreman: ''
  });
  const [foremanTransferringDefect, setForemanTransferringDefect] = useState<string | null>(null);
  const [foremanTransferForm, setForemanTransferForm] = useState({
    worker: ''
  });
  const [rejectingDefect, setRejectingDefect] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showPlanViewer, setShowPlanViewer] = useState(false);
  const [selectedApartmentForPlan, setSelectedApartmentForPlan] = useState<string>('');
  const [planUrl, setPlanUrl] = useState<string>('');
  const [planLoading, setPlanLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{x: number, y: number, room: string} | null>(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [viewingPlanWithMarks, setViewingPlanWithMarks] = useState<{defect: Defect, marks: any[]} | null>(null);
  const [selectedDefectForPlan, setSelectedDefectForPlan] = useState<SupabaseDefect | null>(null);

  // Хук для получения количества дефектов
  const { refreshDefectsCount } = useDefectsCount();

  // Состояние для дефектов из Supabase
  const [supabaseDefects, setSupabaseDefects] = useState<SupabaseDefect[]>([]);
  const [loadingSupabaseDefects, setLoadingSupabaseDefects] = useState(false);

  // Функция для загрузки дефектов из Supabase
  const loadSupabaseDefects = async () => {
    try {
      setLoadingSupabaseDefects(true);
      console.log('🔄 Начинаем загрузку дефектов из Supabase...');
      const defects = await getAllDefects();
      console.log('📊 Получены дефекты:', defects);
      setSupabaseDefects(defects);
      console.log('✅ Загружено дефектов из Supabase:', defects.length);
      
      if (defects.length === 0) {
        console.log('⚠️ Дефекты не найдены. Возможные причины:');
        console.log('   - Таблица defects не создана в Supabase');
        console.log('   - Нет данных в таблице');
        console.log('   - Проблемы с подключением к Supabase');
        console.log('   - Используется localStorage (нет подключения к Supabase)');
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки дефектов из Supabase:', error);
    } finally {
      setLoadingSupabaseDefects(false);
    }
  };


  // Функция для проверки localStorage дефектов
  const checkLocalStorageDefects = () => {
    try {
      const stored = localStorage.getItem('defects_data');
      if (stored) {
        const defects = JSON.parse(stored);
        console.log('📦 Найдены дефекты в localStorage:', defects.length);
        return defects;
      } else {
        console.log('📦 localStorage пуст - нет сохраненных дефектов');
        return [];
      }
    } catch (error) {
      console.error('❌ Ошибка чтения localStorage:', error);
      return [];
    }
  };

  // Загружаем дефекты из Supabase при монтировании компонента
  React.useEffect(() => {
    console.log('🚀 Инициализация компонента DefectsView');
    console.log('🔍 Текущий режим:', getCurrentMode());
    
    // Проверяем localStorage
    checkLocalStorageDefects();
    
    // Загружаем из Supabase
    loadSupabaseDefects();
  }, []);

  // Список всех квартир проекта "ЖК Вишневый сад"
  const apartments = [
    '101', '201', '202', '203', '301', '302', '303', '401', '402', '403', '404',
    '501', '502', '503', '504', '601', '602', '603', '604', '701', '702', '703', '704',
    '801', '802', '803', '804', '901', '902', '903', '904', '1001', '1002', '1003', '1004',
    '1101', '1102', '1103', '1104', '1201', '1202', '1203', '1204', '1301', '1302', '1401'
  ];

  // Моковые данные дефектов - используем useState для возможности добавления новых
  const [defects, setDefects] = useState<Defect[]>([]);

  const severityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  };

  const statusColors = {
    open: 'bg-red-100 text-red-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800'
  };

  const statusIcons = {
    open: XCircle,
    'in-progress': Clock,
    resolved: CheckCircle,
    closed: CheckCircle
  };

  const categoryLabels = {
    structural: 'Конструктивные',
    electrical: 'Электрика',
    plumbing: 'Сантехника',
    finishing: 'Отделка',
    safety: 'Безопасность',
    other: 'Прочее'
  };

  const filteredDefects = defects.filter(defect => {
    const matchesFilter = selectedFilter === 'all' || defect.status === selectedFilter;
    const matchesSearch = defect.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         defect.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Проверяем, заполнены ли обязательные поля
  const isFormValid = defectForm.project && defectForm.apartment && defectForm.title && defectForm.description && defectForm.location;

  // Функция для определения типа квартиры и соответствующего плана (синхронизировано с useSupabase.ts)
  const getApartmentTypeAndPlan = (apartmentNumber: string) => {
    // Извлекаем номер квартиры из строки (убираем префикс корпуса У/T)
    let cleanApartmentNumber = apartmentNumber.trim();
    
    // Определяем корпус по префиксу
    const hasUPrefix = cleanApartmentNumber.startsWith('У') || cleanApartmentNumber.startsWith('у') || 
                       cleanApartmentNumber.startsWith('U') || cleanApartmentNumber.startsWith('u');
    const hasTPrefix = cleanApartmentNumber.startsWith('T') || cleanApartmentNumber.startsWith('т') ||
                       cleanApartmentNumber.startsWith('t');
    
    // Убираем префикс, если есть
    if (hasUPrefix || hasTPrefix) {
      cleanApartmentNumber = cleanApartmentNumber.replace(/^[УуUuTтt]\s*/, '');
    }
    
    // Определяем корпус: если есть префикс У или номер квартиры из корпуса У
    const buildingUApartments = ['501', '502', '503', '504', '704'];
    const isBuildingU = hasUPrefix || buildingUApartments.includes(cleanApartmentNumber);
    
    // Полный список всех квартир из таблицы
    const allApartments = [
      // Этаж 1
      '101',
      // Этаж 2
      '201', '202', '203',
      // Этаж 3
      '301', '302', '303',
      // Этаж 4
      '401', '402', '403', '404',
      // Этаж 5
      '501', '502', '503', '504',
      // Этаж 6
      '601', '602', '603', '604',
      // Этаж 7
      '701', '702', '703', '704',
      // Этаж 8
      '801', '802', '803', '804',
      // Этаж 9
      '901', '902', '903', '904',
      // Этаж 10
      '1001', '1002', '1003', '1004',
      // Этаж 11
      '1101', '1102', '1103', '1104',
      // Этаж 12
      '1201', '1202', '1203', '1204',
      // Этаж 13
      '1301', '1302',
      // Этаж 14
      '1401'
    ];

    // Проверяем, есть ли квартира в списке
    if (!allApartments.includes(cleanApartmentNumber)) {
      return {
        type: 'unknown',
        planApartment: cleanApartmentNumber,
        isTypical: false,
        building: isBuildingU ? 'U' : 'T'
      };
    }

    // Индивидуальные квартиры (имеют свои уникальные планы)
    const individualApartments = ['404', '504', '704', '804', '1204']; // 403 и 603 теперь используются для типовых квартир

    if (individualApartments.includes(cleanApartmentNumber)) {
      return {
        type: 'individual',
        planApartment: cleanApartmentNumber,
        isTypical: false,
        building: isBuildingU ? 'U' : 'T'
      };
    }

    // Типовые квартиры - определяем по последней цифре
    const typicalPlanMap: { [key: string]: string } = {
      '1': '403', // Типовые квартиры 1 используют план 403
      '2': '402', // Типовые квартиры 2 используют план 402
      '3': '603', // Типовые квартиры 3 используют план 603
      '4': '804'  // Типовые квартиры 4 используют план 804
    };

    const lastDigit = cleanApartmentNumber.slice(-1);
    const planApartment = typicalPlanMap[lastDigit] || cleanApartmentNumber;

    return {
      type: 'typical',
      planApartment,
      isTypical: true,
      typicalGroup: lastDigit,
      building: isBuildingU ? 'U' : 'T'
    };
  };

  // Функция для загрузки плана квартиры из Supabase (синхронизировано с useSupabase.ts)
  const loadApartmentPlan = async (apartment: string) => {
    setPlanLoading(true);
    try {
      console.log(`🏠 Загружаем план для квартиры: ${apartment}`);
      
      // Определяем тип квартиры и источник плана
      const { type, planApartment, isTypical, typicalGroup, building } = getApartmentTypeAndPlan(apartment);
      console.log(`📋 Квартира ${apartment}:`, { type, planApartment, isTypical, typicalGroup, building });
      
      // Определяем, относится ли квартира к корпусу У (используем информацию из getApartmentTypeAndPlan)
      const isBuildingU = building === 'U';
      
      // Получаем все файлы из Storage (бакет plan, файлы в корне)
      const { data: allFilesData, error: allFilesError } = await supabaseAdmin.storage
        .from('plan')
        .list('', { limit: 1000 });

      if (allFilesError) {
        console.error('Ошибка получения файлов из Storage:', allFilesError);
        return null;
      }
      
      console.log('🔍 Все файлы из Storage:', allFilesData);
      
      // Ищем файлы для квартиры-источника плана (planApartment)
      const planFiles = allFilesData?.filter(file => {
        const fileName = file.name;
        
        if (isBuildingU) {
          // Для корпуса У ищем файлы с префиксом У (кириллица) или U (латиница)
          // Сначала проверяем, что файл НЕ относится к корпусу Т
          const isBuildingT = fileName.match(/T(\d+)/);
          if (isBuildingT) {
            console.log(`❌ Пропущен файл корпуса Т для корпуса У: ${fileName}`);
            return false;
          }
          
          // Ищем файлы с префиксом У или U
          const planMatch = fileName.match(/[УU](\d+)/);
          if (planMatch) {
            const fileApartmentNum = planMatch[1];
            const matches = fileApartmentNum === planApartment;
            if (matches) {
              console.log(`✅ Найден файл для У${planApartment}: ${fileName}`);
            }
            return matches;
          }
          
          console.log(`⚠️ Файл не относится к корпусу У: ${fileName}`);
          return false;
        } else {
          // Для корпуса Т ищем файлы с префиксом T (исключаем файлы корпуса У)
          const isBuildingU = fileName.match(/[УU](\d+)/);
          if (isBuildingU) {
            console.log(`❌ Пропущен файл корпуса У для корпуса Т: ${fileName}`);
            return false;
          }
          
          const planMatch = fileName.match(/T(\d+)/);
          if (planMatch) {
            const fileApartmentNum = planMatch[1];
            return fileApartmentNum === planApartment;
          }
          return false;
        }
      }) || [];
      
      console.log(`📋 Файлы для плана квартиры ${planApartment}:`, planFiles);

      // В приоритете PNG/JPG превью (как в мобилке)
      const previewFile = planFiles.find(file => {
        const name = file.name.toLowerCase();
        return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
      });

      if (previewFile) {
        const { data } = supabaseAdmin.storage
          .from('plan')
          .getPublicUrl(previewFile.name);

        console.log(`✅ Найден preview-план: ${previewFile.name} -> ${data.publicUrl}`);
        return data.publicUrl;
      }

      // Фолбэк на PDF (для просмотра, если превью нет)
      const pdfFile = planFiles.find(file => file.name.toLowerCase().endsWith('.pdf'));

      if (pdfFile) {
        const { data } = supabaseAdmin.storage
          .from('plan')
          .getPublicUrl(pdfFile.name);

        console.log(`✅ Найден PDF-план (фолбэк): ${pdfFile.name} -> ${data.publicUrl}`);
        return data.publicUrl;
      }

      console.log(`❌ План (preview/PDF) не найден для квартиры ${apartment} (источник: ${planApartment}, корпус: ${isBuildingU ? 'У' : 'Т'})`);
      return null;
    } catch (error) {
      console.error('Error loading apartment plan:', error);
      return null;
    } finally {
      setPlanLoading(false);
    }
  };

  // Функция для открытия плана квартиры
  const handleOpenPlanViewer = async (apartment: string) => {
    console.log('Opening plan viewer for apartment:', apartment);
    setSelectedApartmentForPlan(apartment);
    setShowPlanViewer(true);
    
    // Загружаем план
    const url = await loadApartmentPlan(apartment);
    setPlanUrl(url || '');
  };

         // Функция для закрытия плана квартиры
         const handleClosePlanViewer = () => {
           setShowPlanViewer(false);
           setSelectedApartmentForPlan('');
           setPlanUrl('');
           setSelectedLocation(null);
           setIsSelectingLocation(false);
           setSelectedDefectForPlan(null);
         };

         // Функция для выбора места дефекта на плане
         const handleSelectDefectLocation = (location: string) => {
           setDefectForm({...defectForm, location: location});
           handleClosePlanViewer();
         };

         // Функция для начала выбора местоположения на плане
         const handleStartLocationSelection = () => {
           console.log('🎯 Начинаем выбор местоположения на плане');
           setIsSelectingLocation(true);
           setSelectedLocation(null);
         };

         const handlePlanLocationSelect = (x: number, y: number) => {
           // Определяем комнату по координатам (примерная логика)
           let room = 'Неизвестная комната';
           if (x < 30 && y < 40) room = 'Кухня';
           else if (x > 30 && x < 70 && y < 40) room = 'Гостиная';
           else if (x < 30 && y > 40 && y < 80) room = 'Спальня 1';
           else if (x > 30 && x < 70 && y > 40 && y < 80) room = 'Спальня 2';
           else if (x > 70 && y > 40) room = 'Ванная комната';
           else if (x > 30 && x < 70 && y > 80) room = 'Прихожая';

           setSelectedLocation({ x, y, room });
         };

         // Функция для подтверждения выбранного местоположения
         const handleConfirmLocation = () => {
           if (selectedLocation) {
             const locationString = `Квартира ${selectedApartmentForPlan}, ${selectedLocation.room} (${selectedLocation.x.toFixed(1)}%, ${selectedLocation.y.toFixed(1)}%)`;
             
             // Создаем отметку на плане
             const planMark = {
               x: selectedLocation.x,
               y: selectedLocation.y,
               room: selectedLocation.room,
               planUrl: planUrl,
               apartmentNumber: selectedApartmentForPlan,
               markId: `mark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
             };
             
             setDefectForm({
               ...defectForm, 
               location: locationString,
               apartmentNumber: selectedApartmentForPlan,
               planMark: planMark
             });
             
             console.log('✅ Отметка на плане сохранена:', planMark);
             handleClosePlanViewer();
           }
         };

         // Функция для просмотра плана с отметками дефекта
         const handleViewPlanWithMarks = (defect: Defect) => {
           if (defect.planMark) {
             setViewingPlanWithMarks({
               defect: defect,
               marks: [defect.planMark]
             });
           }
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

  // Функция для создания нового дефекта
  const handleCreateDefect = async () => {
    if (!isFormValid) return;

    try {
      // Определяем apartment_id из формы
      const apartmentId = defectForm.apartment || defectForm.apartmentNumber || null;
      
      // Подготавливаем данные для Supabase
      const defectData: Omit<SupabaseDefect, 'id' | 'created_at' | 'updated_at'> = {
        apartment_id: apartmentId || '',
        title: defectForm.title,
        description: defectForm.description || undefined,
        photo_url: photoPreviewUrls.length > 0 ? photoPreviewUrls[0] : undefined,
        status: 'active',
        x_coord: defectForm.planMark?.x || 50.0,
        y_coord: defectForm.planMark?.y || 50.0
      };

      // Сохраняем дефект в базу данных
      const createdDefect = await createDefect(defectData);
      
      if (!createdDefect) {
        console.error('Ошибка создания дефекта в базе данных');
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
        return;
      }

      // Создаем локальный объект дефекта для отображения
      const newDefect: Defect = {
        id: createdDefect.id,
        projectId: defectForm.project,
        title: defectForm.title,
        description: defectForm.description,
        location: defectForm.apartment ? `ЖК "Вишневый сад", квартира ${defectForm.apartment}, ${defectForm.location}` : defectForm.location,
        severity: defectForm.severity,
        status: 'open',
        reportedBy: userRole === 'foreman' ? 'Прораб' : userRole === 'technadzor' ? 'ТехНадзор' : 'Подрядчик',
        reportedDate: new Date().toISOString().split('T')[0],
        assignedTo: defectForm.assignedTo || undefined,
        photos: photoPreviewUrls,
        videos: [],
        comments: [],
        category: defectForm.category,
        // Сохраняем информацию об отметке на плане
        apartmentNumber: defectForm.apartmentNumber,
        planMark: defectForm.planMark
      };

      // Добавляем новый дефект в начало списка
      setDefects(prevDefects => [newDefect, ...prevDefects]);
      
      // Обновляем счетчик дефектов и список дефектов
      refreshDefectsCount();
      loadSupabaseDefects();
      
      // Сброс формы
      setDefectForm({
        project: '',
        apartment: '',
        title: '',
        description: '',
        location: '',
        severity: 'medium',
        category: 'other',
        assignedTo: '',
        apartmentNumber: '',
        planMark: undefined
      });
      setSelectedPhotos([]);
      setPhotoPreviewUrls([]);
      
      // Закрытие формы создания
      setIsCreatingDefect(false);
      
      
      // Показываем уведомление об успешном создании
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    } catch (error) {
      console.error('Ошибка создания дефекта:', error);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    }
  };

  // Функция для сброса формы
  const handleCancelDefect = () => {
    setDefectForm({
      project: '',
      apartment: '',
      title: '',
      description: '',
      location: '',
      severity: 'medium',
      category: 'other',
      assignedTo: '',
      apartmentNumber: '',
      planMark: undefined
    });
    setSelectedPhotos([]);
    setPhotoPreviewUrls([]);
    setIsCreatingDefect(false);
  };

  // Функция для создания дефекта заказчиком для подрядчика
  const handleCreateClientDefect = () => {
    if (!clientDefectForm.project || !clientDefectForm.apartment || !clientDefectForm.title || !clientDefectForm.description || !clientDefectForm.location || !clientDefectForm.assignedTo) return;


    const newDefect: Defect = {
      id: Date.now().toString(),
      projectId: clientDefectForm.project,
      title: clientDefectForm.title,
      description: clientDefectForm.description,
      location: clientDefectForm.apartment ? `ЖК "Вишневый сад", квартира ${clientDefectForm.apartment}, ${clientDefectForm.location}` : clientDefectForm.location,
      severity: clientDefectForm.severity,
      status: 'open',
      reportedBy: 'Заказчик',
      reportedDate: new Date().toISOString().split('T')[0],
      assignedTo: clientDefectForm.assignedTo,
      photos: photoPreviewUrls,
      videos: [],
      comments: [],
      category: clientDefectForm.category
    };

    // Добавляем новый дефект в начало списка
    setDefects(prevDefects => [newDefect, ...prevDefects]);
    
    // Отмечаем дефект как созданный заказчиком
    setClientCreatedDefects(prev => new Set([...prev, newDefect.id]));
    
    // Обновляем счетчик дефектов и список дефектов
    refreshDefectsCount();
    loadSupabaseDefects();
    
    // Сброс формы
    setClientDefectForm({
      project: '',
      apartment: '',
      title: '',
      description: '',
      location: '',
      severity: 'medium',
      category: 'other',
      assignedTo: ''
    });
    setSelectedPhotos([]);
    setPhotoPreviewUrls([]);
    
    // Закрытие формы создания
    setIsCreatingClientDefect(false);
    
    // Показываем уведомление об успешном создании
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // Функция для сброса формы дефекта заказчика
  const handleCancelClientDefect = () => {
    setClientDefectForm({
      project: '',
      apartment: '',
      title: '',
      description: '',
      location: '',
      severity: 'medium',
      category: 'other',
      assignedTo: ''
    });
    setSelectedPhotos([]);
    setPhotoPreviewUrls([]);
    setIsCreatingClientDefect(false);
  };

  // Функция для начала передачи дефекта прорабу
  const handleStartTransferDefect = (defect: Defect) => {
    setTransferringDefect(defect.id);
    setTransferForm({
      foreman: ''
    });
  };

  // Функция для отмены передачи дефекта
  const handleCancelTransferDefect = () => {
    setTransferringDefect(null);
    setTransferForm({
      foreman: ''
    });
  };

  // Функция для начала отказа от дефекта
  const handleStartRejectDefect = (defect: Defect) => {
    setRejectingDefect(defect.id);
    setRejectReason('');
  };

  // Функция для отмены отказа от дефекта
  const handleCancelRejectDefect = () => {
    setRejectingDefect(null);
    setRejectReason('');
  };

  // Функция для подтверждения отказа от дефекта
  const handleRejectDefect = () => {
    if (!rejectReason.trim()) return;

    setDefects(prevDefects => 
      prevDefects.map(defect => 
        defect.id === rejectingDefect 
          ? { 
              ...defect, 
              status: 'closed' as 'open' | 'in-progress' | 'resolved' | 'closed',
              assignedTo: undefined,
              comments: [
                ...defect.comments,
                {
                  id: `reject_${Date.now()}`,
                  author: 'Подрядчик',
                  date: new Date().toISOString().split('T')[0],
                  text: `Отказ от дефекта. Причина: ${rejectReason}`,
                  photos: []
                }
              ]
            }
          : defect
      )
    );

    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
    handleCancelRejectDefect();
  };

  // Функция для передачи дефекта прорабу
  const handleTransferDefect = () => {
    if (!transferForm.foreman) return;

    console.log('Передача дефекта:', {
      defectId: transferringDefect,
      foreman: transferForm.foreman,
      currentDefects: defects.length
    });

    // Обновляем дефект - меняем назначение
    setDefects(prevDefects => {
      const updatedDefects = prevDefects.map(defect => 
        defect.id === transferringDefect 
          ? { 
              ...defect, 
              assignedTo: transferForm.foreman,
              status: 'open' as 'open' | 'in-progress' | 'resolved' | 'closed'
            }
          : defect
      );
      
      console.log('Обновленные дефекты:', updatedDefects);
      return updatedDefects;
    });

    // Показываем уведомление о передаче
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
    handleCancelTransferDefect();
  };

  // Функция для начала передачи дефекта рабочим от прораба
  const handleStartForemanTransferDefect = (defect: Defect) => {
    setForemanTransferringDefect(defect.id);
    setForemanTransferForm({
      worker: ''
    });
  };

  // Функция для отмены передачи дефекта рабочим
  const handleCancelForemanTransferDefect = () => {
    setForemanTransferringDefect(null);
    setForemanTransferForm({
      worker: ''
    });
  };

  // Функция для передачи дефекта рабочим от прораба
  const handleForemanTransferDefect = () => {
    if (!foremanTransferForm.worker) return;

    console.log('Передача дефекта рабочим:', {
      defectId: foremanTransferringDefect,
      worker: foremanTransferForm.worker,
      currentDefects: defects.length
    });

    // Обновляем дефект - меняем назначение
    setDefects(prevDefects => {
      const updatedDefects = prevDefects.map(defect => 
        defect.id === foremanTransferringDefect 
          ? { 
              ...defect, 
              assignedTo: foremanTransferForm.worker,
              status: 'open' as 'open' | 'in-progress' | 'resolved' | 'closed'
            }
          : defect
      );
      
      console.log('Обновленные дефекты:', updatedDefects);
      return updatedDefects;
    });

    // Показываем уведомление о передаче
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
    handleCancelForemanTransferDefect();
  };

  // Функция для начала редактирования дефекта (для технадзора)
  const handleStartEditDefect = (defect: Defect) => {
    setEditingDefect(defect.id);
    setEditForm({
      status: defect.status,
      assignedTo: defect.assignedTo || ''
    });
  };

  // Функция для отмены редактирования дефекта
  const handleCancelEditDefect = () => {
    setEditingDefect(null);
    setEditForm({
      status: 'open',
      assignedTo: ''
    });
  };

  // Функция для сохранения изменений дефекта (для технадзора)
  const handleSaveEditDefect = () => {
    setDefects(prevDefects => 
      prevDefects.map(defect => 
        defect.id === editingDefect 
          ? { 
              ...defect, 
              status: editForm.status, 
              assignedTo: editForm.assignedTo,
              ...(editForm.status === 'resolved' && !defect.resolvedDate ? { resolvedDate: new Date().toISOString().split('T')[0] } : {})
            }
          : defect
      )
    );

    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
    handleCancelEditDefect();
  };

  // Функция для маппинга статусов Supabase в статусы компонента
  const mapSupabaseStatusToComponent = (supabaseStatus: 'active' | 'fixed', statusDetail?: 'open' | 'in-progress' | 'resolved' | 'closed'): 'open' | 'in-progress' | 'resolved' | 'closed' => {
    // Если есть status_detail, используем его
    if (statusDetail) {
      return statusDetail;
    }
    // Иначе маппим по старому полю status
    return supabaseStatus === 'active' ? 'open' : 'resolved';
  };

  // Функция для маппинга статусов компонента в статусы Supabase
  const mapComponentStatusToSupabase = (componentStatus: 'open' | 'in-progress' | 'resolved' | 'closed'): 'active' | 'fixed' => {
    return (componentStatus === 'open' || componentStatus === 'in-progress') ? 'active' : 'fixed';
  };

  // Функция для изменения статуса дефекта (для технадзора и подрядчика)
  const handleDefectStatusChange = async (defectId: string, newStatus: 'open' | 'in-progress' | 'resolved' | 'closed') => {
    try {
      // Обновляем статус через API
      const updatedDefect = await updateDefectStatus(defectId, newStatus);
      
      if (updatedDefect) {
        // Обновляем локальное состояние
        setDefects(prevDefects => 
          prevDefects.map(defect => 
            defect.id === defectId 
              ? { 
                  ...defect, 
                  status: newStatus,
                  ...(newStatus === 'resolved' && !defect.resolvedDate ? { resolvedDate: new Date().toISOString().split('T')[0] } : {})
                }
              : defect
          )
        );
        
        // Показываем уведомление об успешном изменении
        setStatusChanged(true);
        setShowNotification(true);
        setTimeout(() => {
          setShowNotification(false);
          setStatusChanged(false);
        }, 3000);
        
        console.log(`Статус дефекта ${defectId} изменен на ${newStatus}`);
      }
    } catch (error) {
      console.error('Ошибка при изменении статуса дефекта:', error);
      // Можно добавить уведомление об ошибке
    }
  };

  // Функция для изменения статуса дефекта из Supabase (для технадзора и подрядчика)
  const handleSupabaseDefectStatusChange = async (defectId: string, newStatus: 'open' | 'in-progress' | 'resolved' | 'closed') => {
    try {
      console.log('🔄 Обновляем статус дефекта:', defectId, 'на:', newStatus);
      
      // Обновляем статус через API (передаем newStatus, который содержит status_detail)
      const updatedDefect = await updateDefectStatus(defectId, newStatus);
      
      if (updatedDefect) {
        // Обновляем локальное состояние для дефектов из Supabase
        setSupabaseDefects(prevDefects => 
          prevDefects.map(defect => 
            defect.id === defectId 
              ? { 
                  ...defect, 
                  status: updatedDefect.status,
                  status_detail: updatedDefect.status_detail,
                  updated_at: updatedDefect.updated_at
                }
              : defect
          )
        );
        
        console.log('✅ Статус дефекта обновлен:', updatedDefect);
        
        // Показываем уведомление об успешном изменении
        setStatusChanged(true);
        setShowNotification(true);
        setTimeout(() => {
          setShowNotification(false);
          setStatusChanged(false);
        }, 3000);
        
        console.log(`Статус дефекта Supabase ${defectId} изменен на ${newStatus}`);
      } else {
        console.error('❌ updateDefectStatus вернул null для дефекта:', defectId);
      }
    } catch (error) {
      console.error('❌ Ошибка при изменении статуса дефекта Supabase:', error);
      // Можно добавить уведомление об ошибке
    }
  };


  // Функция для выбора фотографий для комментария
  const handleCommentPhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newPhotos = Array.from(files);
      setCommentPhotos(prev => [...prev, ...newPhotos]);
      
      // Создаем превью для новых фотографий
      newPhotos.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setCommentPhotoUrls(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Функция для удаления фотографии из комментария
  const handleRemoveCommentPhoto = (index: number) => {
    setCommentPhotos(prev => prev.filter((_, i) => i !== index));
    setCommentPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Функция для добавления комментария к дефекту
  const handleAddComment = (defectId: string) => {
    if (!commentText.trim()) return;

    const newComment: DefectComment = {
      id: Date.now().toString(),
      author: userRole === 'worker' ? 'Рабочий' : userRole === 'foreman' ? 'Прораб' : 'Подрядчик',
      date: new Date().toISOString().split('T')[0],
      text: commentText,
      photos: commentPhotoUrls
    };

    // Добавляем комментарий к дефекту
    setDefects(prevDefects => 
      prevDefects.map(defect => 
        defect.id === defectId 
          ? { ...defect, comments: [...defect.comments, newComment] }
          : defect
      )
    );

    // Сброс формы комментария
    setCommentText('');
    setCommentPhotos([]);
    setCommentPhotoUrls([]);
    setReplyingToDefect(null);

    // Показываем уведомление
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // Функция для отмены комментария
  const handleCancelComment = () => {
    setCommentText('');
    setCommentPhotos([]);
    setCommentPhotoUrls([]);
    setReplyingToDefect(null);
  };

  // Функция для взятия дефекта в работу
  const handleTakeToWork = (defectId: string) => {
    setDefects(prevDefects => 
      prevDefects.map(defect => 
        defect.id === defectId 
          ? { 
              ...defect, 
              status: 'in-progress',
              assignedTo: userRole === 'foreman' ? 'Прораб' : 'Подрядчик'
            }
          : defect
      )
    );

    setTakenToWork(defectId);

    // Показываем уведомление
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
      setTakenToWork(null);
    }, 3000);
  };

  // Функция для закрытия модального окна просмотра
  const handleCloseView = () => {
    setViewingDefect(null);
  };

  // Функция для отметки дефекта как решенного
  const handleMarkAsResolved = (defectId: string) => {
    setDefects(prevDefects => 
      prevDefects.map(defect => 
        defect.id === defectId 
          ? { 
              ...defect, 
              status: 'resolved',
              resolvedDate: new Date().toISOString().split('T')[0]
            }
          : defect
      )
    );

    setResolvedDefect(defectId);

    // Показываем уведомление
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
      setResolvedDefect(null);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {showNotification && (
        <div className="fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          <div className="flex items-center space-x-2">
            <span>✓</span>
                    <span>
          {statusChanged ? 'Статус дефекта успешно изменен!' :
           resolvedDefect ? 'Дефект отмечен как решенный!' :
           takenToWork ? 'Дефект взят в работу!' :
           replyingToDefect ? 'Комментарий добавлен!' :
           transferringDefect ? 'Дефект передан прорабу!' :
           rejectingDefect ? 'Дефект отклонен!' :
           'Дефект успешно создан!'}
        </span>
          </div>
        </div>
      )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">Дефекты</h1>
            <p className="text-slate-400 mt-1">
              Управление дефектами и несоответствиями в проектах
            </p>
            <div className="mt-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                getCurrentMode() === 'Supabase' 
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-200 border-amber-500/30'
              }`}>
                {getCurrentMode() === 'Supabase' ? '🟢 Supabase' : '🟡 localStorage'}
              </span>
              <span className="ml-2 text-xs text-slate-400">
                {getCurrentMode() === 'Supabase' 
                  ? 'Синхронизировано с базой данных' 
                  : 'Работает в автономном режиме'}
              </span>
            </div>
          </div>
          {(userRole === 'foreman' || userRole === 'contractor' || userRole === 'technadzor' || userRole === 'client') && (
            <div className="flex space-x-2">
              <div className="text-sm text-slate-400 flex items-center space-x-2">
                <Building className="w-4 h-4 text-slate-500" />
                <span>Дефекты создаются через архитектурные планы</span>
              </div>
            </div>
          )}
        </div>

      {/* Фильтры и поиск */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={loadSupabaseDefects}
            disabled={loadingSupabaseDefects}
            className="px-3 py-2 border border-blue-500/30 bg-blue-500/20 text-blue-200 rounded-xl hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <Building className="w-4 h-4" />
            <span>{loadingSupabaseDefects ? 'Загрузка...' : 'Обновить дефекты с планов'}</span>
          </button>
        </div>
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Поиск дефектов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30"
          >
            <option value="all" className="bg-slate-800 text-white">Все статусы</option>
            <option value="open" className="bg-slate-800 text-white">Открытые</option>
            <option value="in-progress" className="bg-slate-800 text-white">В работе</option>
            <option value="resolved" className="bg-slate-800 text-white">Решенные</option>
            <option value="closed" className="bg-slate-800 text-white">Закрытые</option>
          </select>
        </div>
      </div>

      {/* Дефекты из Supabase (созданные через архитектурные планы) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Building className="w-5 h-5 mr-2 text-blue-300" />
            Дефекты с архитектурных планов ({supabaseDefects.length})
          </h3>
        </div>
        
        {loadingSupabaseDefects && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-400">Загрузка дефектов из Supabase...</p>
          </div>
        )}
        
        {!loadingSupabaseDefects && supabaseDefects.length === 0 && (
          <div className="text-center py-8 bg-white/5 border border-white/10 rounded-2xl">
            <div className="mb-4">
              <Building className="w-12 h-12 mx-auto mb-2 text-slate-500" />
              <h3 className="text-lg font-medium text-white mb-2">Дефекты не найдены</h3>
              <p className="text-sm text-slate-400 mb-4">
                {getCurrentMode() === 'Supabase' 
                  ? 'В базе данных пока нет дефектов.'
                  : 'Работаем в автономном режиме. Дефекты сохраняются локально в браузере.'
                }
              </p>
            </div>
          </div>
        )}
        
        {!loadingSupabaseDefects && supabaseDefects.length > 0 && (
          <div className="space-y-4">
            {supabaseDefects.map((defect) => (
              <div key={defect.id} className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)] p-6 relative overflow-visible" style={{ zIndex: 'auto' }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <DefectStatusChanger
                        currentStatus={mapSupabaseStatusToComponent(defect.status, defect.status_detail)}
                        userRole={userRole}
                        onStatusChange={(newStatus) => handleSupabaseDefectStatusChange(defect.id, newStatus)}
                      />
                      <span className="text-sm font-medium text-slate-300">
                        Квартира {defect.apartment_id}
                      </span>
                    </div>
                    
                    <h4 className="text-lg font-semibold text-white mb-2">
                      {defect.title}
                    </h4>
                    
                    {defect.description && (
                      <p className="text-base text-slate-200 mb-3 leading-snug">
                        {defect.description}
                      </p>
                    )}
                    
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>Координаты: {defect.x_coord}%, {defect.y_coord}%</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>{new Date(defect.created_at).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {defect.photo_url && (
                      <div className="w-16 h-16 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
                        <img 
                          src={defect.photo_url} 
                          alt="Фото дефекта" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setSelectedDefectForPlan(defect);
                        setSelectedApartmentForPlan(defect.apartment_id);
                        handleOpenPlanViewer(defect.apartment_id);
                      }}
                      className="p-2 text-blue-300 hover:text-blue-200 hover:bg-blue-500/20 rounded-xl transition-colors border border-transparent hover:border-blue-500/30"
                      title="Открыть на плане"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Список дефектов */}
      <div className="space-y-4">
                {filteredDefects.filter(defect => {
          // Заказчик видит дефекты, которые он создал (включая переданные)
          if (userRole === 'client') {
            return clientCreatedDefects.has(defect.id);
          }
          // Прорабы видят дефекты, назначенные им (включая переданные от подрядчика) И дефекты, которые они передали рабочим
          if (userRole === 'foreman') {
            return (defect.assignedTo && defect.assignedTo.includes('Прораб')) || 
                   (defect.assignedTo && defect.assignedTo.includes('Рабочий'));
          }
          // Рабочие видят дефекты, переданные им прорабом
          if (userRole === 'worker') {
            return defect.assignedTo && defect.assignedTo.includes('Рабочий');
          }
          // Подрядчики видят все дефекты (включая созданные заказчиком), кроме переданных рабочим
          if (userRole === 'contractor') {
            return !(defect.assignedTo && defect.assignedTo.includes('Рабочий'));
          }
          // Технадзор видит все дефекты (включая созданные заказчиком и переданные рабочим)
          if (userRole === 'technadzor') {
            return true;
          }
          // Остальные роли видят все дефекты (кроме созданных заказчиком и переданных рабочим)
          if (clientCreatedDefects.has(defect.id) || (defect.assignedTo && defect.assignedTo.includes('Рабочий'))) {
            return false;
          }
          return true;
        }).map((defect) => {
          const StatusIcon = statusIcons[defect.status];
          return (
            <div key={defect.id} className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)] p-6 relative overflow-visible" style={{ zIndex: 'auto' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{defect.title}</h3>
                    {clientCreatedDefects.has(defect.id) && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30">
                        От заказчика
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${severityColors[defect.severity]}`}>
                      {defect.severity === 'low' ? 'Низкая' :
                       defect.severity === 'medium' ? 'Средняя' :
                       defect.severity === 'high' ? 'Высокая' : 'Критическая'}
                    </span>
                    <DefectStatusChanger
                      currentStatus={defect.status}
                      userRole={userRole}
                      onStatusChange={(newStatus) => handleDefectStatusChange(defect.id, newStatus)}
                    />
                  </div>
                  <p className="text-base text-slate-200 mb-3 leading-snug">{defect.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm font-medium text-slate-300">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{defect.location}</span>
                      {defect.planMark && (
                        <button
                          onClick={() => handleViewPlanWithMarks(defect)}
                          className="ml-2 p-1 text-blue-300 hover:text-blue-200 hover:bg-blue-500/20 rounded-lg transition-colors"
                          title="Показать на плане"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{new Date(defect.reportedDate).toLocaleDateString('ru')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{defect.reportedBy}</span>
                    </div>
                    {defect.assignedTo && (
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Исполнитель: {defect.assignedTo}</span>
                      </div>
                    )}
                    {defect.estimatedCost && (
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>₽{defect.estimatedCost.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Медиа файлы */}
              {(defect.photos.length > 0 || defect.videos.length > 0) && (
                <div className="mb-4">
                  <div className="flex items-center space-x-4 mb-2">
                    {defect.photos.length > 0 && (
                      <div className="flex items-center space-x-1 text-sm text-slate-400">
                        <Camera className="w-4 h-4" />
                        <span>{defect.photos.length} фото</span>
                      </div>
                    )}
                    {defect.videos.length > 0 && (
                      <div className="flex items-center space-x-1 text-sm text-slate-400">
                        <Video className="w-4 h-4" />
                        <span>{defect.videos.length} видео</span>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 overflow-x-auto">
                    {defect.photos.slice(0, 3).map((photo, index) => (
                      <div key={index} className="w-20 h-20 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {photo.startsWith('data:') ? (
                          <img 
                            src={photo} 
                            alt={`Фото ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                    ))}
                    {defect.videos.slice(0, 1).map((_, index) => (
                      <div key={index} className="w-20 h-20 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Video className="w-6 h-6 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Комментарии */}
              {defect.comments.length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-white">Комментарии ({defect.comments.length})</span>
                  </div>
                  <div className="space-y-3">
                    {defect.comments.slice(0, 2).map((comment) => (
                      <div key={comment.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white">{comment.author}</span>
                          <span className="text-xs text-slate-400">{new Date(comment.date).toLocaleDateString('ru')}</span>
                        </div>
                        <p className="text-sm text-slate-200 mb-2">{comment.text}</p>
                        
                        {comment.photos && comment.photos.length > 0 && (
                          <div className="flex space-x-2 overflow-x-auto">
                            {comment.photos.map((photo, index) => (
                              <div key={index} className="w-16 h-16 bg-white/10 border border-white/10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {photo.startsWith('data:') ? (
                                  <img 
                                    src={photo} 
                                    alt={`Фото ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Camera className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Действия */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-slate-400">
                    Категория: {categoryLabels[defect.category]}
                  </span>
                </div>
                <div className="flex space-x-2">
                  {(userRole === 'foreman' || userRole === 'contractor') && (
                    <button 
                      onClick={() => setViewingDefect(defect.id)}
                      className="px-3 py-1 text-sm border border-blue-500/30 bg-blue-500/20 text-blue-200 rounded-xl hover:bg-blue-500/30 transition-colors"
                    >
                      Просмотр
                    </button>
                  )}
                  {userRole === 'technadzor' && defect.assignedTo && defect.assignedTo.includes('Прораб') && (
                    <button 
                      onClick={() => setViewingDefect(defect.id)}
                      className="px-3 py-1 text-sm border border-blue-500/30 bg-blue-500/20 text-blue-200 rounded-xl hover:bg-blue-500/30 transition-colors"
                    >
                      Просмотр
                    </button>
                  )}
                  {userRole === 'client' && clientCreatedDefects.has(defect.id) && (
                    <button 
                      onClick={() => setViewingDefect(defect.id)}
                      className="px-3 py-1 text-sm border border-blue-500/30 bg-blue-500/20 text-blue-200 rounded-xl hover:bg-blue-500/30 transition-colors"
                    >
                      Просмотр
                    </button>
                  )}
                  {userRole === 'worker' && (
                    <button 
                      onClick={() => setReplyingToDefect(defect.id)}
                      className="px-3 py-1 text-sm bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors"
                    >
                      Добавить комментарий
                    </button>
                  )}
                  {defect.status === 'open' && (userRole === 'foreman' || userRole === 'contractor') && (
                    <button 
                      onClick={() => handleTakeToWork(defect.id)}
                      className="px-3 py-1 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      Взять в работу
                    </button>
                  )}
                  {defect.status === 'open' && userRole === 'technadzor' && defect.assignedTo && defect.assignedTo.includes('Прораб') && (
                    <button 
                      onClick={() => handleStartEditDefect(defect)}
                      className="px-3 py-1 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      Назначить прорабу
                    </button>
                  )}
                  {defect.status === 'open' && userRole === 'client' && clientCreatedDefects.has(defect.id) && defect.assignedTo && defect.assignedTo.includes('Подрядчик') && (
                    <button 
                      onClick={() => handleStartEditDefect(defect)}
                      className="px-3 py-1 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      Назначить подрядчику
                    </button>
                  )}
                  {/* Кнопка передачи дефекта прорабу для подрядчика */}
                  {userRole === 'contractor' && clientCreatedDefects.has(defect.id) && defect.status === 'open' && (
                    <button 
                      onClick={() => handleStartTransferDefect(defect)}
                      className="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      Передать прорабу
                    </button>
                  )}
                  {/* Кнопка передачи дефекта рабочим для прораба */}
                  {userRole === 'foreman' && defect.status === 'open' && (
                    <button 
                      onClick={() => handleStartForemanTransferDefect(defect)}
                      className="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      Передать рабочему
                    </button>
                  )}
                </div>
              </div>

              {/* Форма добавления комментария */}
              {replyingToDefect === defect.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Добавить комментарий о выполненных работах</h4>
                  
                  <div className="space-y-3">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Опишите, как вы исправили дефект..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    ></textarea>
                    
                    <div className="flex space-x-2">
                      <label className="flex-1 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white">
                        <Camera className="w-4 h-4" />
                        <span>Добавить фото</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleCommentPhotoSelect}
                          className="hidden"
                        />
                      </label>
                      <button 
                        disabled={!commentText.trim()}
                        onClick={() => handleAddComment(defect.id)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          commentText.trim() 
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Отправить
                      </button>
                      <button 
                        onClick={handleCancelComment}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                    
                    {commentPhotoUrls.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-900 mb-2">Выбранные фотографии ({commentPhotoUrls.length})</h5>
                        <div className="grid grid-cols-3 gap-2">
                          {commentPhotoUrls.map((url, index) => (
                            <div key={index} className="relative">
                              <img 
                                src={url} 
                                alt={`Фото ${index + 1}`}
                                className="w-full h-20 object-cover rounded-lg"
                              />
                              <button
                                onClick={() => handleRemoveCommentPhoto(index)}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Сообщение о том, что дефекты не соответствуют фильтрам */}
      {(defects.length > 0 || supabaseDefects.length > 0) && filteredDefects.filter(defect => {
        // Заказчик видит дефекты, которые он создал (включая переданные)
        if (userRole === 'client') {
          return clientCreatedDefects.has(defect.id);
        }
        // Прорабы видят дефекты, назначенные им (включая переданные от подрядчика) И дефекты, которые они передали рабочим
        if (userRole === 'foreman') {
          return (defect.assignedTo && defect.assignedTo.includes('Прораб')) || 
                 (defect.assignedTo && defect.assignedTo.includes('Рабочий'));
        }
        // Рабочие видят дефекты, переданные им прорабом
        if (userRole === 'worker') {
          return defect.assignedTo && defect.assignedTo.includes('Рабочий');
        }
        // Подрядчики видят все дефекты (включая созданные заказчиком), кроме переданных рабочим
        if (userRole === 'contractor') {
          return !(defect.assignedTo && defect.assignedTo.includes('Рабочий'));
        }
        // Остальные роли видят все дефекты (кроме созданных заказчиком и переданных рабочим)
        if (clientCreatedDefects.has(defect.id) || (defect.assignedTo && defect.assignedTo.includes('Рабочий'))) {
          return false;
        }
        return true;
      }).length === 0 && (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет доступных дефектов</h3>
          <p className="text-gray-500">
            Дефекты есть, но они не доступны для вашей роли или не соответствуют текущим фильтрам
          </p>
        </div>
      )}

      {/* Форма создания дефекта - отключена */}
      {false && isCreatingDefect && (
        <div className="bg-white/40 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 p-6 hover:shadow-md transition-all duration-300">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Создание дефекта</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Проект</label>
                <select 
                  value={defectForm.project}
                  onChange={(e) => setDefectForm({...defectForm, project: e.target.value, apartment: ''})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Выберите проект</option>
                  <option value="zhk-vishnevyy-sad">ЖК "Вишневый сад"</option>
                </select>
              </div>
              
              {defectForm.project && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Квартира</label>
                  <select 
                    value={defectForm.apartment}
                    onChange={(e) => setDefectForm({...defectForm, apartment: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите квартиру</option>
                    {apartments.map(apartment => (
                      <option key={apartment} value={apartment}>Квартира {apartment}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Название дефекта</label>
                <input
                  type="text"
                  value={defectForm.title}
                  onChange={(e) => setDefectForm({...defectForm, title: e.target.value})}
                  placeholder="Краткое описание проблемы"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Местоположение дефекта</label>
                {defectForm.apartment ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPlanViewer(defectForm.apartment)}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>Открыть план квартиры {defectForm.apartment}</span>
                    </button>
                    {defectForm.location && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          <strong>Выбрано:</strong> {defectForm.location}
                        </p>
                        <button
                          type="button"
                          onClick={() => setDefectForm({...defectForm, location: ''})}
                          className="text-xs text-green-600 hover:text-green-800 underline mt-1"
                        >
                          Изменить
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <p className="text-sm text-slate-400">Сначала выберите квартиру</p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Важность</label>
                  <select 
                    value={defectForm.severity}
                    onChange={(e) => setDefectForm({...defectForm, severity: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Низкая</option>
                    <option value="medium">Средняя</option>
                    <option value="high">Высокая</option>
                    <option value="critical">Критическая</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Категория</label>
                  <select 
                    value={defectForm.category}
                    onChange={(e) => setDefectForm({...defectForm, category: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="structural">Конструктивные</option>
                    <option value="electrical">Электрика</option>
                    <option value="plumbing">Сантехника</option>
                    <option value="finishing">Отделка</option>
                    <option value="safety">Безопасность</option>
                    <option value="other">Прочее</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Подробное описание</label>
                <textarea
                  value={defectForm.description}
                  onChange={(e) => setDefectForm({...defectForm, description: e.target.value})}
                  placeholder="Детальное описание дефекта..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                ></textarea>
              </div>
              
              {userRole === 'technadzor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Назначить прорабу</label>
                  <select 
                    value={defectForm.assignedTo || ''}
                    onChange={(e) => setDefectForm({...defectForm, assignedTo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите прораба</option>
                    <option value="Прораб Иванов">Прораб Иванов</option>
                    <option value="Прораб Петров">Прораб Петров</option>
                    <option value="Прораб Сидоров">Прораб Сидоров</option>
                  </select>
                </div>
              )}
              
              <div className="flex space-x-2">
                <label 
                  className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2 cursor-pointer ${
                    isFormValid 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
                  disabled={!isFormValid}
                  onClick={handleCreateDefect}
                  className={`flex-1 py-2 rounded-lg transition-colors ${
                    isFormValid 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Создать дефект
                </button>
              </div>
            </div>
            
            <div className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
              isFormValid 
                ? 'border-blue-400 hover:border-blue-500 bg-blue-50' 
                : 'border-gray-300 bg-gray-50'
            }`}>
              {selectedPhotos.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Выбранные фотографии ({selectedPhotos.length})</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {photoPreviewUrls.map((url, index) => (
                      <div key={index} className="relative">
                        <img 
                          src={url} 
                          alt={`Фото ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="mt-3 block text-center">
                    <span className="text-blue-600 hover:text-blue-700 text-sm cursor-pointer">
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
                    isFormValid ? 'text-blue-400' : 'text-slate-400'
                  }`} />
                  {isFormValid ? (
                    <>
                      <p className="text-blue-600 font-medium">Нажмите "Добавить фото" для выбора</p>
                      <p className="text-xs text-blue-500 mt-1">PNG, JPG до 10MB</p>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-400">Область загрузки файлов</p>
                      <p className="text-xs text-slate-400 mt-1">Сначала заполните информацию о дефекте</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подробного просмотра дефекта */}
      {viewingDefect && (() => {
        const defect = defects.find(d => d.id === viewingDefect);
        if (!defect) return null;
        
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCloseView}>
            <div className="bg-slate-900 rounded-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Подробная информация о дефекте</h2>
                  <div className="flex items-center space-x-3">
                    {(userRole === 'foreman' || userRole === 'contractor' || userRole === 'technadzor') && defect.status === 'in-progress' && (
                      <button 
                        onClick={() => handleMarkAsResolved(defect.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Решен</span>
                      </button>
                    )}
                    {userRole === 'contractor' && clientCreatedDefects.has(defect.id) && defect.status === 'open' && (
                      <button 
                        onClick={() => handleStartRejectDefect(defect)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Отказаться</span>
                      </button>
                    )}
                    <button 
                      onClick={handleCloseView}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Основная информация */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">{defect.title}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-400 mb-2">Описание:</p>
                        <p className="text-white">{defect.description}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 mb-2">Местоположение:</p>
                        <p className="text-white">{defect.location}</p>
                      </div>
                    </div>
                  </div>

                  {/* Статус и метаданные */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <h4 className="font-medium text-white mb-2">Статус</h4>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[defect.status]}`}>
                         {(() => {
                           const StatusIcon = statusIcons[defect.status];
                           return <StatusIcon className="w-4 h-4 mr-1" />;
                         })()}
                        {defect.status === 'open' ? 'Открыт' :
                         defect.status === 'in-progress' ? 'В работе' :
                         defect.status === 'resolved' ? 'Решен' : 'Закрыт'}
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <h4 className="font-medium text-white mb-2">Важность</h4>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${severityColors[defect.severity]}`}>
                        {defect.severity === 'low' ? 'Низкая' :
                         defect.severity === 'medium' ? 'Средняя' :
                         defect.severity === 'high' ? 'Высокая' : 'Критическая'}
                      </span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <h4 className="font-medium text-white mb-2">Категория</h4>
                      <span className="text-sm text-white">{categoryLabels[defect.category]}</span>
                    </div>
                  </div>

                  {/* Детальная информация */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <h4 className="font-medium text-white mb-3">Информация о дефекте</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Заявитель:</span>
                          <span className="text-white">{defect.reportedBy}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Дата заявления:</span>
                          <span className="text-white">{new Date(defect.reportedDate).toLocaleDateString('ru')}</span>
                        </div>
                        {defect.assignedTo && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Исполнитель:</span>
                            <span className="text-white">{defect.assignedTo}</span>
                          </div>
                        )}
                        {defect.dueDate && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Срок выполнения:</span>
                            <span className="text-white">{new Date(defect.dueDate).toLocaleDateString('ru')}</span>
                          </div>
                        )}
                        {defect.resolvedDate && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Дата решения:</span>
                            <span className="text-white">{new Date(defect.resolvedDate).toLocaleDateString('ru')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <h4 className="font-medium text-white mb-3">Финансовая информация</h4>
                      <div className="space-y-2 text-sm">
                        {defect.estimatedCost && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Ориентировочная стоимость:</span>
                            <span className="text-white">₽{defect.estimatedCost.toLocaleString()}</span>
                          </div>
                        )}
                        {defect.actualCost && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Фактическая стоимость:</span>
                            <span className="text-white">₽{defect.actualCost.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Медиа файлы */}
                  {(defect.photos.length > 0 || defect.videos.length > 0) && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <h4 className="font-medium text-white mb-3">Медиа файлы</h4>
                      <div className="space-y-4">
                        {defect.photos.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-slate-300 mb-2 flex items-center">
                              <Camera className="w-4 h-4 mr-1" />
                              Фотографии ({defect.photos.length})
                            </h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {defect.photos.map((photo, index) => (
                                <div key={index} className="aspect-square bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                                  {photo.startsWith('data:') ? (
                                    <img 
                                      src={photo} 
                                      alt={`Фото ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Camera className="w-8 h-8 text-slate-400" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {defect.videos.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-slate-300 mb-2 flex items-center">
                              <Video className="w-4 h-4 mr-1" />
                              Видео ({defect.videos.length})
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {defect.videos.map((_, index) => (
                                <div key={index} className="aspect-video bg-white/5 border border-white/10 rounded-lg flex items-center justify-center">
                                  <Video className="w-8 h-8 text-slate-400" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Комментарии */}
                  {defect.comments.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <h4 className="font-medium text-white mb-3 flex items-center">
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Комментарии ({defect.comments.length})
                      </h4>
                      <div className="space-y-3">
                        {defect.comments.map((comment) => (
                          <div key={comment.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-white">{comment.author}</span>
                              <span className="text-xs text-slate-400">{new Date(comment.date).toLocaleDateString('ru')}</span>
                            </div>
                            <p className="text-sm text-slate-300 mb-2">{comment.text}</p>
                            {comment.photos && comment.photos.length > 0 && (
                              <div className="flex space-x-2 overflow-x-auto">
                                {comment.photos.map((photo, index) => (
                                  <div key={index} className="w-16 h-16 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {photo.startsWith('data:') ? (
                                      <img 
                                        src={photo} 
                                        alt={`Фото ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <Camera className="w-4 h-4 text-slate-400" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Форма редактирования дефекта для технадзора */}
      {editingDefect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-white/10 max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">Управление дефектом прораба</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Статус</label>
                <select 
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value as any})}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                >
                  <option value="open" className="bg-slate-800">Открыт</option>
                  <option value="in-progress" className="bg-slate-800">В работе</option>
                  <option value="resolved" className="bg-slate-800">Решен</option>
                  <option value="closed" className="bg-slate-800">Закрыт</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Назначить прорабу</label>
                <select 
                  value={editForm.assignedTo}
                  onChange={(e) => setEditForm({...editForm, assignedTo: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                >
                  <option value="" className="bg-slate-800">Выберите прораба</option>
                  <option value="Прораб Иванов" className="bg-slate-800">Прораб Иванов</option>
                  <option value="Прораб Петров" className="bg-slate-800">Прораб Петров</option>
                  <option value="Прораб Сидоров" className="bg-slate-800">Прораб Сидоров</option>
                </select>
              </div>
              
              <div className="flex space-x-2 pt-4">
                <button 
                  onClick={handleSaveEditDefect}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
                >
                  Сохранить
                </button>
                <button 
                  onClick={handleCancelEditDefect}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Форма создания дефекта заказчиком для подрядчика - отключена */}
      {false && isCreatingClientDefect && (
        <div className="bg-white/40 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 p-6 hover:shadow-md transition-all duration-300">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Создание дефекта для подрядчика</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Проект</label>
                <select 
                  value={clientDefectForm.project}
                  onChange={(e) => setClientDefectForm({...clientDefectForm, project: e.target.value, apartment: ''})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Выберите проект</option>
                  <option value="zhk-vishnevyy-sad">ЖК "Вишневый сад"</option>
                </select>
              </div>
              
              {clientDefectForm.project && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Квартира</label>
                  <select 
                    value={clientDefectForm.apartment}
                    onChange={(e) => setClientDefectForm({...clientDefectForm, apartment: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите квартиру</option>
                    {apartments.map(apartment => (
                      <option key={apartment} value={apartment}>Квартира {apartment}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Название дефекта</label>
                <input
                  type="text"
                  value={clientDefectForm.title}
                  onChange={(e) => setClientDefectForm({...clientDefectForm, title: e.target.value})}
                  placeholder="Краткое описание проблемы"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Местоположение дефекта</label>
                {clientDefectForm.apartment ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPlanViewer(clientDefectForm.apartment)}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>Открыть план квартиры {clientDefectForm.apartment}</span>
                    </button>
                    {clientDefectForm.location && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          <strong>Выбрано:</strong> {clientDefectForm.location}
                        </p>
                        <button
                          type="button"
                          onClick={() => setClientDefectForm({...clientDefectForm, location: ''})}
                          className="text-xs text-green-600 hover:text-green-800 underline mt-1"
                        >
                          Изменить
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <p className="text-sm text-slate-400">Сначала выберите квартиру</p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Важность</label>
                  <select 
                    value={clientDefectForm.severity}
                    onChange={(e) => setClientDefectForm({...clientDefectForm, severity: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Низкая</option>
                    <option value="medium">Средняя</option>
                    <option value="high">Высокая</option>
                    <option value="critical">Критическая</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Категория</label>
                  <select 
                    value={clientDefectForm.category}
                    onChange={(e) => setClientDefectForm({...clientDefectForm, category: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="structural">Конструктивные</option>
                    <option value="electrical">Электрика</option>
                    <option value="plumbing">Сантехника</option>
                    <option value="finishing">Отделка</option>
                    <option value="safety">Безопасность</option>
                    <option value="other">Прочее</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Подрядчик</label>
                <select 
                  value={clientDefectForm.assignedTo}
                  onChange={(e) => setClientDefectForm({...clientDefectForm, assignedTo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Выберите подрядчика</option>
                  <option value="Подрядчик ООО СтройМонтаж">Подрядчик ООО СтройМонтаж</option>
                  <option value="Подрядчик ИП Петров">Подрядчик ИП Петров</option>
                  <option value="Подрядчик ЗАО СтройГрупп">Подрядчик ЗАО СтройГрупп</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Подробное описание</label>
                <textarea
                  value={clientDefectForm.description}
                  onChange={(e) => setClientDefectForm({...clientDefectForm, description: e.target.value})}
                  placeholder="Детальное описание дефекта для подрядчика..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                ></textarea>
              </div>
              
              <div className="flex space-x-2">
                <label 
                  className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2 cursor-pointer ${
                    clientDefectForm.project && clientDefectForm.apartment && clientDefectForm.title && clientDefectForm.description && clientDefectForm.location && clientDefectForm.assignedTo
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Добавить фото</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    disabled={!clientDefectForm.project || !clientDefectForm.apartment || !clientDefectForm.title || !clientDefectForm.description || !clientDefectForm.location || !clientDefectForm.assignedTo}
                    className="hidden"
                  />
                </label>
                <button 
                  disabled={!clientDefectForm.project || !clientDefectForm.apartment || !clientDefectForm.title || !clientDefectForm.description || !clientDefectForm.location || !clientDefectForm.assignedTo}
                  onClick={handleCreateClientDefect}
                  className={`flex-1 py-2 rounded-lg transition-colors ${
                    clientDefectForm.project && clientDefectForm.apartment && clientDefectForm.title && clientDefectForm.description && clientDefectForm.location && clientDefectForm.assignedTo
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Создать дефект
                </button>
              </div>
            </div>
            
            <div className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
              clientDefectForm.project && clientDefectForm.apartment && clientDefectForm.title && clientDefectForm.description && clientDefectForm.location && clientDefectForm.assignedTo
                ? 'border-blue-400 hover:border-blue-500 bg-blue-50' 
                : 'border-gray-300 bg-gray-50'
            }`}>
              {selectedPhotos.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Выбранные фотографии ({selectedPhotos.length})</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {photoPreviewUrls.map((url, index) => (
                      <div key={index} className="relative">
                        <img 
                          src={url} 
                          alt={`Фото ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="mt-3 block text-center">
                    <span className="text-blue-600 hover:text-blue-700 text-sm cursor-pointer">
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
                    clientDefectForm.project && clientDefectForm.apartment && clientDefectForm.title && clientDefectForm.description && clientDefectForm.location && clientDefectForm.assignedTo ? 'text-blue-400' : 'text-slate-400'
                  }`} />
                  {clientDefectForm.project && clientDefectForm.apartment && clientDefectForm.title && clientDefectForm.description && clientDefectForm.location && clientDefectForm.assignedTo ? (
                    <>
                      <p className="text-blue-600 font-medium">Нажмите "Добавить фото" для выбора</p>
                      <p className="text-xs text-blue-500 mt-1">PNG, JPG до 10MB</p>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-400">Область загрузки файлов</p>
                      <p className="text-xs text-slate-400 mt-1">Сначала заполните информацию о дефекте</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

            {/* Модальное окно передачи дефекта прорабу */}
      {transferringDefect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Передача дефекта прорабу</h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Информация:</strong><br/>
                  Дефект будет передан выбранному прорабу для устранения. Статус дефекта изменится на "Открыт".
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Выберите прораба</label>
                <select 
                  value={transferForm.foreman}
                  onChange={(e) => setTransferForm({...transferForm, foreman: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Выберите прораба</option>
                  <option value="Прораб Иванов">Прораб Иванов</option>
                  <option value="Прораб Петров">Прораб Петров</option>
                  <option value="Прораб Сидоров">Прораб Сидоров</option>
                  <option value="Прораб Козлов">Прораб Козлов</option>
                </select>
              </div>
            </div>
            
            <div className="flex space-x-2 mt-6">
              <button 
                disabled={!transferForm.foreman}
                onClick={handleTransferDefect}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  transferForm.foreman
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Передать
              </button>
              <button 
                onClick={handleCancelTransferDefect}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно передачи дефекта рабочим */}
      {foremanTransferringDefect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Передача дефекта рабочему</h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Информация:</strong><br/>
                  Дефект будет передан выбранному рабочему для устранения. Статус дефекта изменится на "Открыт".
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Выберите рабочего</label>
                <select 
                  value={foremanTransferForm.worker}
                  onChange={(e) => setForemanTransferForm({...foremanTransferForm, worker: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Выберите рабочего</option>
                  <option value="Рабочий Петров">Рабочий Петров</option>
                  <option value="Рабочий Сидоров">Рабочий Сидоров</option>
                  <option value="Рабочий Козлов">Рабочий Козлов</option>
                  <option value="Рабочий Морозов">Рабочий Морозов</option>
                  <option value="Рабочий Волков">Рабочий Волков</option>
                </select>
              </div>
            </div>
            
            <div className="flex space-x-2 mt-6">
              <button 
                disabled={!foremanTransferForm.worker}
                onClick={handleForemanTransferDefect}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  foremanTransferForm.worker
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Передать
              </button>
              <button 
                onClick={handleCancelForemanTransferDefect}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно отказа от дефекта */}
      {rejectingDefect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-white/10 max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">Отказ от дефекта</h2>
            
            <div className="space-y-4">
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-300">
                  <strong>Внимание!</strong><br/>
                  При отказе от дефекта он будет закрыт и снят с назначения. Заказчик будет уведомлен о причине отказа.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Причина отказа *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Укажите причину отказа от дефекта..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 resize-none transition-all"
                />
              </div>
            </div>
            
            <div className="flex space-x-2 mt-6">
              <button 
                disabled={!rejectReason.trim()}
                onClick={handleRejectDefect}
                className={`flex-1 py-2.5 rounded-lg transition-colors font-medium ${
                  rejectReason.trim()
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Отказаться
              </button>
              <button 
                onClick={handleCancelRejectDefect}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра плана квартиры */}
      {showPlanViewer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-white/10 max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-white">
                  План квартиры {selectedApartmentForPlan}
                </h2>
                {selectedDefectForPlan && (
                  <p className="text-sm text-slate-400 mt-1">
                    Дефект: {selectedDefectForPlan.title}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {selectedDefectForPlan && (
                  <button
                    onClick={handleClosePlanViewer}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Закрыть
                  </button>
                )}
                <button
                  onClick={handleClosePlanViewer}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
               <div className="flex h-[calc(90vh-80px)]">
                 {/* PDF Viewer */}
                 <div className="flex-1 relative">
                {planLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-400">Загрузка плана...</p>
                    </div>
                  </div>
                ) : planUrl ? (
                  <div className="h-full relative">
                    <PlanWithSupabaseDefects
                      planUrl={planUrl}
                      apartmentId={selectedApartmentForPlan}
                      className="w-full h-full"
                      userRole={userRole}
                      isSelectingLocation={isSelectingLocation}
                      onPlanLocationSelect={handlePlanLocationSelect}
                      selectedLocation={selectedLocation ? { x: selectedLocation.x, y: selectedLocation.y } : null}
                      onDefectClick={(defect) => {
                        console.log('Дефект выбран:', defect);
                      }}
                      onStatusChange={(defectId, newStatus) => {
                        console.log('Статус дефекта изменен:', defectId, newStatus);
                        // Обновляем список дефектов
                        loadSupabaseDefects();
                      }}
                    />

                    {isSelectingLocation && (
                      <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm" style={{ zIndex: 20 }}>
                        {selectedLocation ? 'Местоположение выбрано. Нажмите "Подтвердить" или выберите другое место.' : 'Кликните на план, чтобы выбрать местоположение дефекта'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Building className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-400 font-medium">План не найден</p>
                      <p className="text-sm text-gray-500 mb-2">
                        Архитектурный план для квартиры {selectedApartmentForPlan} не найден в базе данных
                      </p>
                      {(() => {
                        const { type, planApartment, isTypical, building } = getApartmentTypeAndPlan(selectedApartmentForPlan);
                        return (
                          <div className="text-xs text-slate-400 space-y-1">
                            <p>Тип: {type === 'individual' ? 'Индивидуальная' : type === 'typical' ? 'Типовая' : 'Неизвестная'}</p>
                            <p>Ищем план: {building === 'U' ? 'У' : 'T'}{planApartment}</p>
                            {isTypical && <p>Использует типовой план</p>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Панель выбора комнат - показываем только если не выбран дефект для просмотра */}
              {!selectedDefectForPlan && (
                <div className="w-80 border-l border-gray-200 p-4 overflow-y-auto">
                <div className="mb-4">
                  <p className="text-sm text-slate-400 mb-3">
                    Выберите комнату, где находится дефект:
                  </p>
                  
                  <div className="space-y-2">
                    {/* Кнопка для выбора местоположения на плане */}
                    <button
                      onClick={handleStartLocationSelection}
                      className={`w-full p-3 border rounded text-sm font-medium transition-colors text-left ${
                        isSelectingLocation 
                          ? 'bg-orange-200 border-orange-400 text-orange-800' 
                          : 'bg-orange-100 hover:bg-orange-200 border-orange-300 text-orange-800'
                      }`}
                    >
                      📍 Выбрать на плане
                    </button>
                    
                    <div className="border-t border-gray-200 my-3"></div>
                    
                    <button
                      onClick={() => handleSelectDefectLocation('Кухня')}
                      className="w-full p-3 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded text-sm font-medium text-blue-800 transition-colors text-left"
                    >
                      🍳 Кухня
                    </button>
                    
                    <button
                      onClick={() => handleSelectDefectLocation('Гостиная')}
                      className="w-full p-3 bg-green-100 hover:bg-green-200 border border-green-300 rounded text-sm font-medium text-green-800 transition-colors text-left"
                    >
                      🛋️ Гостиная
                    </button>
                    
                    <button
                      onClick={() => handleSelectDefectLocation('Спальня 1')}
                      className="w-full p-3 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded text-sm font-medium text-purple-800 transition-colors text-left"
                    >
                      🛏️ Спальня 1
                    </button>
                    
                    <button
                      onClick={() => handleSelectDefectLocation('Спальня 2')}
                      className="w-full p-3 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded text-sm font-medium text-purple-800 transition-colors text-left"
                    >
                      🛏️ Спальня 2
                    </button>
                    
                    <button
                      onClick={() => handleSelectDefectLocation('Ванная комната')}
                      className="w-full p-3 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 rounded text-sm font-medium text-yellow-800 transition-colors text-left"
                    >
                      🚿 Ванная комната
                    </button>
                    
                    <button
                      onClick={() => handleSelectDefectLocation('Прихожая')}
                      className="w-full p-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-sm font-medium text-gray-800 transition-colors text-left"
                    >
                      🚪 Прихожая
                    </button>
                  </div>
                  
                  {/* Кнопки для подтверждения выбора местоположения */}
                  {isSelectingLocation && (
                    <div className="mt-4 space-y-2">
                      <div className="border-t border-gray-200 pt-3">
                        <p className="text-sm text-slate-400 mb-2">
                          {selectedLocation ? `Выбрано: ${selectedLocation.room}` : 'Кликните на план для выбора места'}
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={handleConfirmLocation}
                            disabled={!selectedLocation}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                              selectedLocation
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            Подтвердить
                          </button>
                          <button
                            onClick={() => setIsSelectingLocation(false)}
                            className="flex-1 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-auto">
                  <button
                    onClick={handleClosePlanViewer}
                    className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                  >
                    Закрыть
                  </button>
                </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для просмотра плана с отметками */}
      {viewingPlanWithMarks && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                План квартиры {viewingPlanWithMarks.defect.apartmentNumber} - {viewingPlanWithMarks.defect.title}
              </h2>
              <button
                onClick={() => setViewingPlanWithMarks(null)}
                className="text-slate-400 hover:text-slate-400 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="h-[calc(90vh-80px)]">
              <PlanWithMarks
                planUrl={viewingPlanWithMarks.defect.planMark?.planUrl || ''}
                marks={viewingPlanWithMarks.marks}
                apartmentNumber={viewingPlanWithMarks.defect.apartmentNumber || ''}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DefectsView;
