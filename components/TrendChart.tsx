
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SearchTerm, TrendDataPoint, Language } from '../types';
import { translations } from '../translations';

interface TrendChartProps {
  data: TrendDataPoint[];
  terms: SearchTerm[];
  startDate?: string;
  endDate?: string;
  lang: Language;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, terms, startDate, endDate, lang }) => {
  const t = translations[lang];
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
        <p>{lang === 'vi' ? 'Chưa có dữ liệu hiển thị' : 'No data to display'}</p>
      </div>
    );
  }

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US');
  };

  const timeRangeText = startDate && endDate ? `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}` : (lang === 'vi' ? 'Gần đây' : 'Recent');

  return (
    <div className="w-full h-[400px] bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">{t.interestOverTime}</h3>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{timeRangeText}</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} tickMargin={10} tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getDate()}/${date.getMonth() + 1}`;
            }}
          />
          <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} domain={[0, 100]} />
          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} labelFormatter={(label) => formatDateDisplay(label)} />
          <Legend verticalAlign="top" height={36} iconType="circle" />
          {terms.map((term) => (
            <Line key={term.id} type="monotone" dataKey={term.term} stroke={term.color} strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
