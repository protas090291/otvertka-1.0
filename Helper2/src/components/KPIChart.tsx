import React, { useState, useEffect } from 'react';
import { getProjectKPIs } from '../lib/projectsApi';

const KPIChart: React.FC = () => {
  // Статичные реалистичные значения для демонстрации
  const staticKPIs = {
    timelineAdherence: 73,
    qualityScore: 87,
    efficiencyScore: 64
  };

  const [kpis, setKpis] = useState([
    { name: 'Сроки', value: staticKPIs.timelineAdherence, color: 'bg-blue-500', loading: false },
    { name: 'Качество', value: staticKPIs.qualityScore, color: 'bg-purple-500', loading: false },
    { name: 'Эффективность', value: staticKPIs.efficiencyScore, color: 'bg-orange-500', loading: false }
  ]);

  useEffect(() => {
    // Всегда используем статичные значения, не загружаем из API
    setKpis([
      { 
        name: 'Сроки', 
        value: staticKPIs.timelineAdherence, 
        color: 'bg-blue-500',
        loading: false
      },
      { 
        name: 'Качество', 
        value: staticKPIs.qualityScore,
        color: 'bg-purple-500',
        loading: false
      },
      { 
        name: 'Эффективность', 
        value: staticKPIs.efficiencyScore, 
        color: 'bg-orange-500',
        loading: false
      }
    ]);
  }, []);

  return (
    <div className="space-y-4">
      {kpis.map((kpi, index) => (
        <div key={index}>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-slate-400">{kpi.name}</span>
            <span className="text-white font-semibold">
              {kpi.loading ? '...' : `${kpi.value}%`}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className={`${kpi.color} h-2 rounded-full transition-all duration-500`}
              style={{ width: `${kpi.loading ? 0 : kpi.value}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPIChart;