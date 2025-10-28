import ApplicationsSummary from '../components/dashboard/ApplicationsSummary';
import { useI18n } from '../i18n';

const ComiteOuvertureDashboard = () => {
  const { t } = useI18n();
  
  // This dashboard is specifically for Comité d'ouverture
  // They can only see applications
  return (
    <div className="py-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('comite_ouverture.dashboard.title')}
          </h1>
          <p className="text-gray-600">
            {t('comite_ouverture.dashboard.subtitle')}
          </p>
        </div>
        
        {/* Applications Section */}
        <ApplicationsSummary />
      </div>
    </div>
  );
};

export default ComiteOuvertureDashboard;