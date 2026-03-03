/**
 * Компонент для прямого просмотра Яндекс Диска через публичные ссылки
 * БЕЗ использования Edge Function или бэкэнда
 * 
 * Этот компонент открывает Яндекс Диск в новой вкладке или iframe
 */

import React, { useState } from 'react';
import { Cloud, ExternalLink, Home, ArrowLeft, Folder, File } from 'lucide-react';
import { getYandexDiskDirectViewUrl, openYandexDiskInBrowser } from '../lib/yandexDiskDirectApi';

interface YandexDiskDirectViewProps {
  publicKey?: string; // Публичный ключ папки (по умолчанию "BSNe4agC5hSAoA")
  initialPath?: string; // Начальный путь (опционально)
}

const YandexDiskDirectView: React.FC<YandexDiskDirectViewProps> = ({ 
  publicKey = 'BSNe4agC5hSAoA', // Публичный ключ по умолчанию
  initialPath 
}) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath || '');
  const [pathHistory, setPathHistory] = useState<Array<{path: string, name: string}>>([]);

  const handleOpenInBrowser = (path?: string) => {
    openYandexDiskInBrowser(publicKey, path);
  };

  const handleNavigateToPath = (path: string, name: string) => {
    setPathHistory(prev => [...prev, { path: currentPath, name: name || 'Корень' }]);
    setCurrentPath(path);
    // Открываем в новой вкладке при переходе
    openYandexDiskInBrowser(publicKey, path);
  };

  const handleGoBack = () => {
    if (pathHistory.length > 0) {
      const previous = pathHistory[pathHistory.length - 1];
      setPathHistory(prev => prev.slice(0, -1));
      setCurrentPath(previous.path);
      openYandexDiskInBrowser(publicKey, previous.path);
    } else {
      setCurrentPath('');
      openYandexDiskInBrowser(publicKey);
    }
  };

  const handleGoToRoot = () => {
    setCurrentPath('');
    setPathHistory([]);
    openYandexDiskInBrowser(publicKey);
  };

  const viewUrl = getYandexDiskDirectViewUrl(publicKey, currentPath || undefined);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Cloud className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">Яндекс Диск</h1>
            <p className="text-slate-400 text-sm mt-1">
              Прямой доступ через публичные ссылки
            </p>
          </div>
        </div>
        <button
          onClick={() => handleOpenInBrowser(currentPath || undefined)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Открыть в Яндекс Диске</span>
        </button>
      </div>

      {/* Навигация */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-white/10">
        <div className="flex items-center space-x-2 mb-4">
          <button
            onClick={handleGoToRoot}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Корень</span>
          </button>
          {pathHistory.length > 0 && (
            <button
              onClick={handleGoBack}
              className="flex items-center space-x-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </button>
          )}
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center space-x-2 text-sm text-slate-400">
          <span>Путь:</span>
          <span className="text-white font-mono">{currentPath || 'Корень'}</span>
        </div>
      </div>

      {/* Информация */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">
              Как использовать:
            </h2>
            <ul className="space-y-2 text-slate-300 text-sm">
              <li className="flex items-start space-x-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Нажмите "Открыть в Яндекс Диске" для просмотра содержимого</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>В Яндекс Диске вы сможете просматривать все файлы и папки</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Для скачивания файлов используйте кнопки в Яндекс Диске</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-white/10">
            <p className="text-slate-400 text-sm mb-2">Прямая ссылка:</p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={viewUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(viewUrl);
                  alert('Ссылка скопирована!');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Копировать
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Iframe для встраивания (может не работать из-за X-Frame-Options) */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">
          Предпросмотр (может не работать):
        </h3>
        <div className="relative w-full" style={{ height: '600px' }}>
          <iframe
            src={viewUrl}
            className="w-full h-full rounded-lg border border-white/10"
            title="Яндекс Диск"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg">
            <div className="text-center">
              <p className="text-white mb-2">Iframe может быть заблокирован Яндекс Диском</p>
              <button
                onClick={() => handleOpenInBrowser(currentPath || undefined)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Открыть в новой вкладке
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YandexDiskDirectView;
