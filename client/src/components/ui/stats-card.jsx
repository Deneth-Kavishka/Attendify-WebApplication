export default function StatsCard({ title, value, change, changeType, icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-primary',
    green: 'bg-green-100 text-secondary',
    orange: 'bg-orange-100 text-accent',
    red: 'bg-red-100 text-destructive'
  };

  const changeIcon = changeType === 'positive' ? 'fas fa-arrow-up' : 
                    changeType === 'negative' ? 'fas fa-arrow-down' : 
                    'fas fa-clock';

  const changeColor = changeType === 'positive' ? 'text-secondary' :
                     changeType === 'negative' ? 'text-destructive' :
                     'text-accent';

  return (
    <div className="stats-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${changeColor}`}>
              <i className={`${changeIcon} text-xs`}></i>
              <span className="ml-1">{change}</span>
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <i className={`${icon} text-xl`}></i>
        </div>
      </div>
    </div>
  );
}
