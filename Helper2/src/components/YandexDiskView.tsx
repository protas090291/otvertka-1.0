import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Download, 
  RefreshCw, 
  File, 
  Folder, 
  Search, 
  Filter,
  Loader2,
  AlertCircle,
  FileText,
  Image,
  FileSpreadsheet,
  FileType,
  ChevronRight,
  Home,
  ArrowLeft,
  ExternalLink,
  Eye,
  Video
} from 'lucide-react';
import { UserRole } from '../types';
import { 
  getYandexDiskFiles, 
  downloadFromYandexDisk, 
  refreshYandexDiskFiles,
  getYandexDiskDownloadLink,
  getYandexDiskViewLink,
  YandexDiskFile 
} from '../lib/yandexDiskApi';
import FileViewer from './FileViewer';

interface YandexDiskViewProps {
  userRole: UserRole;
}

const YandexDiskView: React.FC<YandexDiskViewProps> = ({ userRole }) => {
  const [files, setFiles] = useState<YandexDiskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'file' | 'dir'>('all');
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [openingFiles, setOpeningFiles] = useState<Set<string>>(new Set());
  const [folderPath, setFolderPath] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>(''); // Текущий путь для навигации (пусто = корень, все папки)
  const [pathHistory, setPathHistory] = useState<Array<{path: string, name: string}>>([]); // История путей для breadcrumbs
  const [viewingFile, setViewingFile] = useState<{url: string; name: string; type: string} | null>(null); // Файл для просмотра

  // Загружаем файлы при открытии компонента и при изменении пути
  useEffect(() => {
    // По умолчанию показываем корень (все папки на Яндекс Диске)
    loadFiles(currentPath || undefined); // undefined = корень
  }, [currentPath]);

  // Автоматическое обновление списка файлов каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      // Обновляем только если компонент видим и не загружается
      if (!loading && !refreshing) {
        loadFiles(currentPath || undefined);
      }
    }, 30000); // 30 секунд

    // Очищаем интервал при размонтировании
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, loading, refreshing]);

  // Обновление при возврате фокуса на окно (когда пользователь возвращается на вкладку)
  useEffect(() => {
    const handleFocus = () => {
      // Обновляем список при возврате фокуса
      if (!loading && !refreshing) {
        loadFiles(currentPath || undefined);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, loading, refreshing]);

  const loadFiles = async (path?: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getYandexDiskFiles(path);
      setFiles(response.files);
      setFolderPath(response.folder_path);
    } catch (err) {
      console.error('Ошибка загрузки файлов из Яндекс Диска:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки файлов');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const response = await refreshYandexDiskFiles(currentPath);
      setFiles(response.files);
      setFolderPath(response.folder_path);
    } catch (err) {
      console.error('Ошибка обновления файлов:', err);
      setError(err instanceof Error ? err.message : 'Ошибка обновления файлов');
    } finally {
      setRefreshing(false);
    }
  };

  const handleFolderClick = (folder: YandexDiskFile) => {
    if (folder.type === 'dir') {
      // Добавляем текущий путь в историю
      if (currentPath) {
        // Находим имя текущей папки из списка файлов
        const currentFolder = files.find(f => f.path === currentPath);
        const currentName = currentFolder?.name || currentPath.split('/').pop() || 'Папка';
        setPathHistory(prev => [...prev, { path: currentPath, name: currentName }]);
      }
      // Используем relativePath если он есть, иначе полный путь
      // relativePath - это путь относительно корня публичной папки, который нужен для API
      const pathToUse = (folder as any).relativePath || folder.path;
      setCurrentPath(pathToUse);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    // Возвращаемся к указанному пути в истории
    if (index === -1) {
      // Корневая папка
      setCurrentPath('');
      setPathHistory([]);
    } else if (index < pathHistory.length) {
      // Путь из истории
      const targetItem = pathHistory[index];
      const newHistory = pathHistory.slice(0, index + 1);
      setPathHistory(newHistory);
      setCurrentPath(targetItem.path);
    }
  };

  const handleDownload = async (file: YandexDiskFile) => {
    try {
      setDownloadingFiles(prev => new Set(prev).add(file.path));
      await downloadFromYandexDisk(file.path, file.name);
    } catch (err) {
      console.error('Ошибка скачивания файла:', err);
      alert(err instanceof Error ? err.message : 'Ошибка скачивания файла');
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.path);
        return newSet;
      });
    }
  };

  const handleOpenFile = async (file: YandexDiskFile) => {
    try {
      setOpeningFiles(prev => new Set(prev).add(file.path));
      
      // Получаем ссылку для просмотра через наш бэкэнд прокси
      // Это позволяет открывать файлы в iframe без проблем с CSP
      const viewUrl = await getYandexDiskViewLink(file.path);
      
      // Открываем файл внутри приложения через FileViewer
      setViewingFile({
        url: viewUrl,
        name: file.name,
        type: file.mime_type || 'application/octet-stream'
      });
    } catch (err) {
      console.error('Ошибка открытия файла:', err);
      alert(err instanceof Error ? err.message : 'Ошибка открытия файла');
    } finally {
      setOpeningFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.path);
        return newSet;
      });
    }
  };

  const handleCloseViewer = () => {
    setViewingFile(null);
  };

  const handleDownloadFromViewer = async () => {
    if (viewingFile) {
      // Находим файл по имени для скачивания
      const file = files.find(f => f.name === viewingFile.name);
      if (file) {
        await handleDownload(file);
      }
    }
  };

  // Фильтрация файлов
  const filteredFiles = files.filter(file => {
    // Фильтр по типу
    if (filterType !== 'all' && file.type !== filterType) {
      return false;
    }
    
    // Поиск по имени
    if (searchTerm && !file.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  // Получить иконку для типа файла
  const getFileIcon = (file: YandexDiskFile) => {
    if (file.type === 'dir') {
      return <Folder className="w-5 h-5 text-blue-400" />;
    }
    
    const mimeType = file.mime_type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    if (mimeType.includes('image') || /\.(jpg|jpeg|png|gif|bmp|webp|svg|heic|heif)$/i.test(fileName)) {
      return <Image className="w-5 h-5 text-green-500" />;
    }
    if (mimeType.includes('video') || /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv|m4v)$/i.test(fileName)) {
      return <Video className="w-5 h-5 text-purple-500" />;
    }
    if (mimeType.includes('spreadsheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    }
    if (mimeType.includes('word') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    }
    
    return <FileType className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Яндекс Диск</h1>
          <p className="text-slate-400 mt-1">
            {folderPath ? `Папка: ${folderPath}` : 'Документы и файлы из Яндекс Диска'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2 border border-blue-500/30 bg-blue-500/20 text-blue-200 rounded-xl hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Обновить список файлов (автообновление каждые 30 секунд)"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Breadcrumbs навигация */}
      {(currentPath || pathHistory.length > 0) && (
        <div className="flex items-center gap-2 text-sm text-slate-300 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
          <button
            onClick={() => {
              setCurrentPath('');
              setPathHistory([]);
            }}
            className="flex items-center gap-1 hover:text-blue-300 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Корень</span>
          </button>
          {pathHistory.map((item, index) => (
            <React.Fragment key={item.path}>
              <ChevronRight className="w-4 h-4 text-slate-500" />
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className="hover:text-blue-300 transition-colors truncate max-w-[200px]"
                title={item.name}
              >
                {item.name}
              </button>
            </React.Fragment>
          ))}
          {currentPath && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-500" />
              <span className="text-white font-medium truncate max-w-[200px]">
                {files.find(f => f.path === currentPath)?.name || currentPath.split('/').pop() || 'Текущая папка'}
              </span>
            </>
          )}
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-red-200 font-medium">Ошибка</p>
            <p className="text-red-200/90 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Фильтры и поиск */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Поиск по имени файла..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'file' | 'dir')}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30"
          >
            <option value="all" className="bg-slate-800 text-white">Все</option>
            <option value="file" className="bg-slate-800 text-white">Файлы</option>
            <option value="dir" className="bg-slate-800 text-white">Папки</option>
          </select>
        </div>
      </div>

      {/* Список файлов */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="ml-3 text-slate-400">Загрузка файлов...</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <File className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">
            {searchTerm || filterType !== 'all' 
              ? 'Файлы не найдены по заданным критериям' 
              : 'Папка пуста или файлы не загружены'}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 shadow-[0_25px_80px_rgba(8,15,40,0.65)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/90 border-b border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Имя
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Тип
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Размер
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Изменен
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredFiles.map((file) => (
                  <tr key={file.path} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file)}
                        <div>
                          {file.type === 'dir' ? (
                            <button
                              onClick={() => handleFolderClick(file)}
                              className="text-sm font-medium text-blue-300 hover:text-blue-200 hover:underline cursor-pointer"
                            >
                              {file.name}
                            </button>
                          ) : (
                            <div className="text-sm font-medium text-white">{file.name}</div>
                          )}
                          {file.type === 'dir' && (
                            <div className="text-xs text-slate-400">Папка - нажмите для открытия</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-200 border border-blue-500/30">
                        {file.type === 'dir' ? 'Папка' : 'Файл'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {file.type === 'file' ? file.size_formatted : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {file.modified_formatted || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {file.type === 'file' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenFile(file)}
                            disabled={openingFiles.has(file.path) || downloadingFiles.has(file.path)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-500/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Открыть файл для просмотра"
                          >
                            {openingFiles.has(file.path) ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Открытие...</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4" />
                                <span>Открыть</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDownload(file)}
                            disabled={downloadingFiles.has(file.path) || openingFiles.has(file.path)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 border border-blue-500/30 bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Скачать файл"
                          >
                            {downloadingFiles.has(file.path) ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Скачивание...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                <span>Скачать</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Статистика */}
      {!loading && files.length > 0 && (
        <div className="text-sm text-slate-400">
          Показано {filteredFiles.length} из {files.length} файлов
        </div>
      )}

      {/* Просмотрщик файлов */}
      {viewingFile && (
        <FileViewer
          fileUrl={viewingFile.url}
          fileName={viewingFile.name}
          fileType={viewingFile.type}
          onClose={handleCloseViewer}
          onDownload={handleDownloadFromViewer}
        />
      )}
    </div>
  );
};

export default YandexDiskView;



