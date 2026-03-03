import React, { useState } from 'react';
import { Upload, CheckCircle, XCircle, Loader, FileImage, AlertCircle } from 'lucide-react';
import { analyzeProgressTableFile, batchImportProgressData, ProgressTableResult } from '../lib/progressTableApi';

interface ProgressTableImporterProps {
  onComplete?: (imported: number, failed: number) => void;
}

const ProgressTableImporter: React.FC<ProgressTableImporterProps> = ({ onComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<ProgressTableResult[] | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAnalysisResults(null);
      setImportResult(null);
      setError(null);
      
      // Создаем preview
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const results = await analyzeProgressTableFile(selectedFile);
      setAnalysisResults(results);
      
      if (results.length === 0) {
        setError('Не удалось извлечь данные из таблицы. Убедитесь, что изображение четкое и таблица хорошо видна.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка анализа таблицы');
      console.error('Ошибка анализа:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!analysisResults || analysisResults.length === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      const result = await batchImportProgressData(
        analysisResults,
        (imported, total) => {
          console.log(`Импортировано: ${imported}/${total}`);
        }
      );

      setImportResult(result);
      onComplete?.(result.imported, result.failed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка импорта данных');
      console.error('Ошибка импорта:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setAnalysisResults(null);
    setImportResult(null);
    setError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 rounded-3xl border border-white/5 shadow-[0_25px_80px_rgba(8,15,40,0.65)]">
      <h3 className="text-2xl font-bold text-white mb-2">
        📊 Импорт прогресса из таблицы
      </h3>
      <p className="text-slate-400 mb-6">
        Загрузите фотографию таблицы прогресса работ. Система автоматически распознает данные и заполнит таблицу прогресса.
      </p>

      <div className="space-y-6">
        {/* Загрузка файла */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Выберите изображение таблицы прогресса
          </label>
          <div className="flex items-center space-x-4">
            <label className="flex-1 cursor-pointer">
              <div className="border-2 border-dashed border-blue-500/30 rounded-lg p-6 hover:border-blue-500/50 transition-colors bg-slate-800/50">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <FileImage className="w-12 h-12 text-blue-400" />
                  <span className="text-sm text-slate-300">
                    {selectedFile ? selectedFile.name : 'Нажмите для выбора файла'}
                  </span>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isAnalyzing || isImporting}
                className="hidden"
              />
            </label>
          </div>
          
          {previewUrl && (
            <div className="mt-4">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-64 rounded-lg border border-white/10"
              />
            </div>
          )}
        </div>

        {/* Кнопка анализа */}
        {selectedFile && !analysisResults && (
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isAnalyzing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Анализ таблицы...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Проанализировать таблицу</span>
              </>
            )}
          </button>
        )}

        {/* Результаты анализа */}
        {analysisResults && analysisResults.length > 0 && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="font-semibold text-white">
                Анализ завершен успешно!
              </span>
            </div>
            <p className="text-sm text-slate-300">
              Найдено записей: <span className="font-bold text-green-400">{analysisResults.length}</span>
            </p>
            
            {/* Предпросмотр данных */}
            <div className="mt-4 max-h-48 overflow-y-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                  <tr>
                    <th className="px-2 py-1">Работа</th>
                    <th className="px-2 py-1">Квартира</th>
                    <th className="px-2 py-1">Прогресс</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisResults.slice(0, 10).map((result, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      <td className="px-2 py-1 truncate max-w-xs" title={result.taskName}>
                        {result.taskName}
                      </td>
                      <td className="px-2 py-1">{result.apartmentId}</td>
                      <td className="px-2 py-1">{result.factProgress}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {analysisResults.length > 10 && (
                <p className="text-xs text-slate-400 mt-2">
                  ... и еще {analysisResults.length - 10} записей
                </p>
              )}
            </div>

            {/* Кнопка импорта */}
            {!importResult && (
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="mt-4 w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isImporting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Импорт данных...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Импортировать в базу данных</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Результаты импорта */}
        {importResult && (
          <div className={`p-4 rounded-lg border ${
            importResult.failed === 0
              ? 'bg-green-500/20 border-green-500/30'
              : 'bg-yellow-500/20 border-yellow-500/30'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              {importResult.failed === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              )}
              <span className="font-semibold text-white">
                Импорт завершен: {importResult.imported} успешно, {importResult.failed} ошибок
              </span>
            </div>
            
            {importResult.errors.length > 0 && (
              <div className="mt-2 text-sm text-yellow-300">
                <p className="font-semibold mb-1">Ошибки:</p>
                <ul className="list-disc list-inside space-y-1 max-h-32 overflow-y-auto">
                  {importResult.errors.map((error, i) => (
                    <li key={i} className="text-xs">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleReset}
              className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
            >
              Загрузить другую таблицу
            </button>
          </div>
        )}

        {/* Ошибки */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="font-semibold text-red-300">Ошибка</span>
            </div>
            <p className="text-sm text-red-200 mt-2">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTableImporter;
