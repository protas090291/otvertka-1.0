import React from 'react';
import { PlanMark } from '../types';

interface PlanWithMarksProps {
  planUrl: string;
  marks: PlanMark[];
  apartmentNumber: string;
  className?: string;
}

const PlanWithMarks: React.FC<PlanWithMarksProps> = ({ 
  planUrl, 
  marks, 
  apartmentNumber, 
  className = '' 
}) => {
  return (
    <div className={`relative ${className}`}>
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
          title={`План квартиры ${apartmentNumber}`}
        />
      </div>
      
      {/* Overlay с отметками */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10, transform: 'scale(1.25)', transformOrigin: 'top left', width: '80%', height: '80%' }}>
        {marks.map((mark) => (
          <div
            key={mark.markId}
            className="absolute"
            style={{
              left: `${mark.x}%`,
              top: `${mark.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {/* Маркер дефекта */}
            <div className="relative">
              <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              
              {/* Подсказка с информацией о дефекте */}
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
                {mark.room}
              </div>
              
              {/* Стрелка к маркеру */}
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-red-500"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanWithMarks;
