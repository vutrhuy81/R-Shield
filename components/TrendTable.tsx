
import React from 'react';
import { SearchTerm, TrendDataPoint, Language } from '../types';
import { translations } from '../translations';

interface TrendTableProps {
  data: TrendDataPoint[];
  terms: SearchTerm[];
  lang: Language;
}

const TrendTable: React.FC<TrendTableProps> = ({ data, terms, lang }) => {
  const t = translations[lang];
  if (!data || data.length === 0) return null;

  const stats = terms.map(term => {
    const values = data.map(d => Number(d[term.term] || 0));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    return { ...term, avg, max, min };
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-800">{t.detailedStats}</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-4 font-medium">{t.keyword}</th>
              <th className="px-6 py-4 font-medium text-center">{t.average}</th>
              <th className="px-6 py-4 font-medium text-center">{t.highest}</th>
              <th className="px-6 py-4 font-medium text-center">{t.lowest}</th>
              <th className="px-6 py-4 font-medium text-right">{t.trend}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></span> {stat.term}
                </td>
                <td className="px-6 py-4 text-center">{stat.avg.toFixed(1)}</td>
                <td className="px-6 py-4 text-center text-green-600 font-medium">{stat.max}</td>
                <td className="px-6 py-4 text-center text-red-600 font-medium">{stat.min}</td>
                <td className="px-6 py-4 text-right">
                    <div className="flex justify-end"><div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${stat.avg}%`, backgroundColor: stat.color }}></div></div></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TrendTable;
