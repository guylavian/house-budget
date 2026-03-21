import { TrendingUp, TrendingDown } from 'lucide-react';
import type { KpiCardProps } from '../../interfaces/components';

const colorConfig = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-600 text-white',
    value: 'text-blue-700',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-600 text-white',
    value: 'text-green-700',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'bg-red-600 text-white',
    value: 'text-red-700',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-600 text-white',
    value: 'text-purple-700',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'bg-orange-600 text-white',
    value: 'text-orange-700',
  },
};

export default function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }: KpiCardProps) {
  const colors = colorConfig[color];

  return (
    <div className={`card ${colors.bg} border-0`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 truncate">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${colors.value} truncate`}>{value}</p>
          {subtitle !== undefined && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(trend.value).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colors.icon} flex-shrink-0 ml-3`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}
