
import React from 'react';
import { SearchTerm, TrendDataPoint, Language } from '../types';
import { translations } from '../translations';

interface EstimatedReachTableProps {
  data: TrendDataPoint[];
  terms: SearchTerm[];
  lang: Language;
}

const K_FACTOR = 6000;

const EstimatedReachTable: React.FC<EstimatedReachTableProps> = ({ data, terms, lang }) => {
  const t = translations[lang];
  if (!data || data.length === 0) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US');
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(num);
  };

  const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
      <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{t.estimatedReach}</h3>
          <p className="text-sm text-gray-500 mt-1">{t.reachFormula.replace('6,000', formatNumber(K_FACTOR))}</p>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm text-left relative">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-4 font-medium min-w-[120px] bg-gray-50">{t.dateLabel}</th>
              {terms.map(term => (
                <th key={term.id} className="px-6 py-4 font-medium text-right min-w-[150px] bg-gray-50" style={{ color: term.color }}>{term.term}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 font-medium text-gray-900">{formatDate(row.date)}</td>
                {terms.map(term => {
                  const indexValue = Number(row[term.term] || 0);
                  const estimatedPeople = Math.round(indexValue * K_FACTOR);
                  return (
                    <td key={term.id} className="px-6 py-3 text-right tabular-nums">
                      <div className="flex flex-col items-end">
                        <span className="font-medium text-gray-900">{formatNumber(estimatedPeople)}</span>
                        <span className="text-[10px] text-gray-400">{t.indexLabel}: {indexValue}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EstimatedReachTable;
