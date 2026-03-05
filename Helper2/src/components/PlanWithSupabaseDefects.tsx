import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Eye, X, ChevronDown, Clock } from 'lucide-react';
import { SupabaseDefect, UserRole } from '../types';
import { getDefectsByApartment, updateDefectStatus } from '../lib/hybridDefectsApi';

interface PlanWithSupabaseDefectsProps {
  planUrl: string;
  apartmentId: string;
  className?: string;
  onDefectClick?: (defect: SupabaseDefect) => void;
  userRole?: UserRole;
  onStatusChange?: (defectId: string, newStatus: string) => void;
}

const PlanWithSupabaseDefects: React.FC<PlanWithSupabaseDefectsProps> = ({ 
  planUrl, 
  apartmentId, 
  className = '',
  onDefectClick,
  userRole = 'technadzor',
  onStatusChange
}) => {
  const [defects, setDefects] = useState<SupabaseDefect[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDefect, setSelectedDefect] = useState<SupabaseDefect | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{x: number, y: number, direction: 'up' | 'down'} | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Загружаем дефекты для квартиры
  useEffect(() => {
    const loadDefects = async () => {
      setLoading(true);
      try {
        const apartmentDefects = await getDefectsByApartment(apartmentId);
        setDefects(apartmentDefects);
        console.log(`Загружено ${apartmentDefects.length} дефектов для квартиры ${apartmentId}`);
      } catch (error) {
        console.error('Ошибка загрузки дефектов:', error);
      } finally {
        setLoading(false);
      }
    };

    if (apartmentId) {
      loadDefects();
    }
  }, [apartmentId]);

  const handleDefectClick = (defect: SupabaseDefect) => {
    setSelectedDefect(defect);
    if (onDefectClick) {
      onDefectClick(defect);
    }
  };

  // Функция для расчета оптимальной позиции dropdown с учетом контейнера карты
  const calculateDropdownPosition = (buttonElement: HTMLElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const dropdownHeight = 240; // Реальная высота dropdown
    const dropdownWidth = 256; // Ширина dropdown
    
    // Получаем контейнер карты для расчета границ
    const mapContainer = buttonElement.closest('.relative') as HTMLElement;
    const mapRect = mapContainer ? mapContainer.getBoundingClientRect() : {
      top: 0,
      left: 0,
      bottom: viewportHeight,
      right: viewportWidth
    };
    
    // Рассчитываем доступное пространство
    const spaceBelow = mapRect.bottom - rect.bottom;
    const spaceAbove = rect.top - mapRect.top;
    const spaceRight = mapRect.right - rect.left;
    const spaceLeft = rect.left - mapRect.left;
    
    // Определяем направление по вертикали (flip logic)
    let direction: 'up' | 'down' = 'down';
    let y = rect.bottom + 4;
    
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      direction = 'up';
      y = rect.top - dropdownHeight - 4;
    }
    
    // Определяем позицию по горизонтали (preventOverflow logic)
    let x = rect.left;
    
    // Если не хватает места справа, сдвигаем влево
    if (spaceRight < dropdownWidth) {
      x = rect.right - dropdownWidth;
    }
    
    // Если все еще не хватает места, прижимаем к границе контейнера
    if (x < mapRect.left) {
      x = mapRect.left + 8; // Отступ от левого края
    }
    
    // Если dropdown выходит за правую границу, прижимаем к правому краю
    if (x + dropdownWidth > mapRect.right) {
      x = mapRect.right - dropdownWidth - 8; // Отступ от правого края
    }
    
    // Дополнительная проверка для вертикального позиционирования
    if (direction === 'up' && y < mapRect.top) {
      direction = 'down';
      y = rect.bottom + 4;
    }
    
    if (direction === 'down' && y + dropdownHeight > mapRect.bottom) {
      direction = 'up';
      y = rect.top - dropdownHeight - 4;
    }
    
    return { x, y, direction };
  };

  // Обработчик клика по статусу дефекта
  const handleStatusClick = (defect: SupabaseDefect, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (activeDropdown === defect.id) {
      setActiveDropdown(null);
      setDropdownPosition(null);
      return;
    }
    
    // Закрываем другие открытые dropdown
    setActiveDropdown(null);
    setDropdownPosition(null);
    
    // Небольшая задержка для корректного расчета позиции
    setTimeout(() => {
      const position = calculateDropdownPosition(event.currentTarget as HTMLElement);
      setDropdownPosition(position);
      setActiveDropdown(defect.id);
    }, 10);
  };

  // Обработчик изменения статуса
  const handleStatusChange = async (defectId: string, newStatus: string) => {
    try {
      await updateDefectStatus(defectId, newStatus as any);
      
      // Обновляем локальное состояние
      setDefects(prevDefects => 
        prevDefects.map(defect => 
          defect.id === defectId 
            ? { ...defect, status: newStatus as 'active' | 'fixed' }
            : defect
        )
      );
      
      // Вызываем callback
      if (onStatusChange) {
        onStatusChange(defectId, newStatus);
      }
      
      setActiveDropdown(null);
      setDropdownPosition(null);
    } catch (error) {
      console.error('Ошибка при изменении статуса дефекта:', error);
    }
  };


  // Закрытие dropdown при клике вне его и предотвращение коллизий
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
        setDropdownPosition(null);
      }
    };

    const handleScroll = () => {
      // Закрываем dropdown при скролле
      setActiveDropdown(null);
      setDropdownPosition(null);
    };

    const handleResize = () => {
      // Пересчитываем позицию при изменении размера окна
      if (activeDropdown && dropdownPosition) {
        const button = document.querySelector(`[data-defect-id="${activeDropdown}"]`) as HTMLElement;
        if (button) {
          const newPosition = calculateDropdownPosition(button);
          setDropdownPosition(newPosition);
        }
      }
    };

    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [activeDropdown, dropdownPosition]);

  const getDefectColor = (status: 'active' | 'fixed') => {
    return status === 'active' ? 'bg-red-500' : 'bg-green-500';
  };

  const getDefectIcon = (status: 'active' | 'fixed') => {
    return status === 'active' ? AlertTriangle : CheckCircle;
  };

  return (
    <div className={`relative map-container ${className}`} style={{ overflow: 'visible' }}>
      {/* PDF Viewer */}
      <div style={{ 
        transform: 'scale(1.25)', 
        transformOrigin: 'top left',
        width: '80%',
        height: '80%'
      }}>
        <iframe
          src={`https://docs.google.com/gview?url=${encodeURIComponent(planUrl)}&embedded=true&toolbar=0&zoom=117`}
          className="w-full h-full border-0"
          style={{ 
            margin: 0, 
            padding: 0,
            pointerEvents: 'none',
            userSelect: 'none',
            touchAction: 'none'
          }}
          title={`План квартиры ${apartmentId}`}
        />
      </div>
      
      {/* Overlay с дефектами */}
      <div className="absolute inset-0 pointer-events-auto" style={{ zIndex: 10, transform: 'scale(1.25)', transformOrigin: 'top left', width: '80%', height: '80%' }}>
        {loading ? (
          <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm">
            Загрузка дефектов...
          </div>
        ) : (
          defects.map((defect) => {
            const IconComponent = getDefectIcon(defect.status);
            const colorClass = getDefectColor(defect.status);
            const canChangeStatus = (userRole === 'technadzor' || userRole === 'contractor');
            
            return (
              <div
                key={defect.id}
                className="absolute pointer-events-auto"
                style={{
                  left: `${defect.x_coord}%`,
                  top: `${defect.y_coord}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                {/* Контейнер дефекта */}
                <div className="relative group flex flex-col items-center">
                  {/* Маркер дефекта */}
                  <div 
                    className={`w-8 h-8 ${colorClass} rounded-full border-2 border-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform cursor-pointer`}
                    onClick={() => handleDefectClick(defect)}
                  >
                    <IconComponent className="w-4 h-4 text-white" />
                  </div>
                  
                  {/* Кнопка статуса (только для технадзора и подрядчика) */}
                  {canChangeStatus && (
                    <button
                      data-defect-id={defect.id}
                      onClick={(e) => handleStatusClick(defect, e)}
                      className={`mt-1 px-2 py-1 text-xs font-medium rounded-full border border-white shadow-lg transition-all hover:shadow-xl ${
                        defect.status === 'active' 
                          ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                      style={{ fontSize: '10px', minWidth: '60px' }}
                    >
                      {defect.status === 'active' ? 'Активен' : 'Исправлен'}
                      <ChevronDown className="w-3 h-3 inline ml-1" />
                    </button>
                  )}
                  
                  {/* Подсказка при наведении */}
                  <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {defect.title}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dropdown меню для изменения статуса */}
      {activeDropdown && dropdownPosition && (
        <div
          ref={dropdownRef}
          className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 max-h-60 overflow-y-auto dropdown-container"
          style={{
            left: `${dropdownPosition.x}px`,
            top: `${dropdownPosition.y}px`,
            width: '256px',
            zIndex: 9999,
            position: 'fixed',
            transform: 'translateZ(0)', // Создаем новый stacking context
            willChange: 'transform' // Оптимизация для GPU
          }}
        >
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 mb-2 px-2">
              Изменить статус дефекта
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                {userRole === 'technadzor' ? 'Технадзор' : 'Подрядчик'}
              </span>
            </div>
            
            {/* Опции статуса */}
            <button
              onClick={() => handleStatusChange(activeDropdown, 'active')}
              className="w-full flex items-start p-2 rounded-md text-left hover:bg-gray-50 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 mr-3 text-red-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-red-600">Активен</div>
                <div className="text-xs text-gray-500 mt-0.5">Дефект требует исправления</div>
              </div>
            </button>
            
            <button
              onClick={() => handleStatusChange(activeDropdown, 'fixed')}
              className="w-full flex items-start p-2 rounded-md text-left hover:bg-gray-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4 mt-0.5 mr-3 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-600">Исправлен</div>
                <div className="text-xs text-gray-500 mt-0.5">Дефект устранен</div>
              </div>
            </button>
            
          </div>
        </div>
      )}

      {/* Модальное окно с деталями дефекта */}
      {selectedDefect && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Дефект в квартире {selectedDefect.apartment_id}
              </h3>
              <button
                onClick={() => setSelectedDefect(null)}
                className="text-gray-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">{selectedDefect.title}</h4>
                {selectedDefect.description && (
                  <p className="text-slate-600 mt-1">{selectedDefect.description}</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-600">Статус:</span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  selectedDefect.status === 'active' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {selectedDefect.status === 'active' ? 'Активный' : 'Исправлен'}
                </span>
              </div>

              {selectedDefect.photo_url && (
                <div>
                  <img
                    src={selectedDefect.photo_url}
                    alt="Фото дефекта"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}

              <div className="text-sm text-gray-500">
                <p>Создан: {new Date(selectedDefect.created_at).toLocaleDateString('ru')}</p>
                <p>Координаты: {selectedDefect.x_coord}%, {selectedDefect.y_coord}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PlanWithSupabaseDefects;
