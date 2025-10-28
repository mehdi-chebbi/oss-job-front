import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import type { Offer, Department, Project } from '../types';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';

// Language-aware navigation hook
const useLanguageNavigate = () => {
  const navigate = useNavigate();
  const { currentLangPrefix } = useI18n();
  
  return (path: string, options?: any) => {
    const isAbsolute = path.startsWith('http');
    const languagePath = isAbsolute ? path : `${currentLangPrefix}${path === '/' ? '' : path}`;
    navigate(languagePath, options);
  };
};

const OfferEditPage = () => {
  const langNavigate = useLanguageNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  
  const [formData, setFormData] = useState({
    type: 'candidature',
    title: '',
    description: '',
    country: '',
    department_id: '',
    project_id: '',
    reference: '',
    deadline: '',
  });

  // Notification emails state
  const [notificationEmails, setNotificationEmails] = useState<string[]>(['']);

  const [tdrFile, setTdrFile] = useState<File | null>(null);

useEffect(() => {
  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        langNavigate('/login');
        return;
      }

      // Load departments and projects
      const [deptResponse, projectResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/departments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        setDepartments(deptData);
      }

      let loadedProjects = [];
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        setProjects(projectData);
        loadedProjects = projectData;
      }

      // Load offer data
      if (id) {
        const offerResponse = await fetch(`${API_BASE_URL}/offers/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (offerResponse.ok) {
          const offerData = await offerResponse.json();
          setFormData({
            type: offerData.type,
            title: offerData.title,
            description: offerData.description,
            country: offerData.country,
            department_id: offerData.department_id?.toString() || '',
            project_id: offerData.project_id?.toString() || '',
            reference: offerData.reference,
            deadline: new Date(offerData.deadline).toISOString().split('T')[0],
          });

          // Parse notification emails if they exist
          if (offerData.notification_emails) {
            try {
              const emails = Array.isArray(offerData.notification_emails) 
                ? offerData.notification_emails 
                : JSON.parse(offerData.notification_emails);
              if (Array.isArray(emails) && emails.length > 0) {
                setNotificationEmails(emails);
              } else {
                setNotificationEmails(['']);
              }
            } catch (e) {
              console.error('Error parsing notification emails:', e);
              setNotificationEmails(['']);
            }
          } else {
            setNotificationEmails(['']);
          }

          // Filter projects for the selected department
          if (offerData.department_id && loadedProjects.length > 0) {
            const deptProjects = loadedProjects.filter((p: Project) => p.department_id === offerData.department_id);
            setFilteredProjects(deptProjects);
          }
        } else {
          setError('Offer not found');
          langNavigate('/rh-dashboard');
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  loadData();
}, [id]); // ✅ Only depend on 'id'

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const departmentId = e.target.value;
    setFormData(prev => ({
      ...prev,
      department_id: departmentId,
      project_id: '' // Reset project when department changes
    }));

    // Filter projects for selected department
    if (departmentId) {
      const deptProjects = projects.filter(project => project.department_id.toString() === departmentId);
      setFilteredProjects(deptProjects);
    } else {
      setFilteredProjects([]);
    }
  };

  // Handle email field changes
  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...notificationEmails];
    newEmails[index] = value;
    setNotificationEmails(newEmails);
  };
  
  // Add new email field
  const addEmailField = () => {
    if (notificationEmails.length < 10) {
      setNotificationEmails([...notificationEmails, '']);
    }
  };
  
  // Remove email field
  const removeEmailField = (index: number) => {
    if (notificationEmails.length > 1) {
      const newEmails = notificationEmails.filter((_, i) => i !== index);
      setNotificationEmails(newEmails);
    }
  };
  
  // Email validation function
  const isValidEmail = (email: string) => {
    if (!email.trim()) return true; // Empty emails are allowed (will be filtered out)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        langNavigate('/login');
        return;
      }

      // Validate required fields
      if (!formData.department_id || !formData.project_id) {
        setError(t('rh.validation.departmentAndProjectRequired'));
        setIsSaving(false);
        return;
      }

      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        submitData.append(key, value);
      });

      // Add notification emails as JSON string
      const validEmails = notificationEmails.filter(email => isValidEmail(email) && email.trim() !== '');
      submitData.append('notification_emails', JSON.stringify(validEmails));

      if (tdrFile) {
        submitData.append('tdr_file', tdrFile);
      }

      const response = await fetch(`${API_BASE_URL}/offers/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: submitData,
      });

      if (response.ok) {
        toast.success('Offer updated successfully!');
        langNavigate('/rh-dashboard');
      } else {
        const errorData = await response.json();
        setError(errorData.error || t('rh.error.updateOffer'));
      }
    } catch (err) {
      console.error('Error updating offer:', err);
      setError(t('rh.error.updateOffer'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-t-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => langNavigate('/rh-dashboard')}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('rh.offer.backToDashboard')}
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{t('rh.offer.editTitle')}</h1>
            <p className="text-gray-600 mt-2">{t('rh.offer.editSubtitle')}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                {t('rh.offer.offerTypeRequired')}
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="candidature">Candidature</option>
                  <option value="manifestation">Manifestation</option>
                  <option value="appel_d_offre_service">Appel d'Offre (Service)</option>
                  <option value="appel_d_offre_equipement">Appel d'Offre (Équipement)</option>
                  <option value="consultation">Consultation</option>
                </select>
              </div>

              <div>
                <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
              {t('rh.offer.referenceRequired')}
                </label>
                <input
                  type="text"
                  id="reference"
                  name="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                {t('rh.offer.titleRequired')}
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                {t('rh.offer.descriptionRequired')}
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>

            {/* Department and Project Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="department_id" className="block text-sm font-medium text-gray-700 mb-2">
          {t('rh.offer.departmentRequired')}
                </label>
                <select
                  id="department_id"
                  name="department_id"
                  value={formData.department_id}
                  onChange={handleDepartmentChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="">{t('rh.offer.selectDepartment')}</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="project_id" className="block text-sm font-medium text-gray-700 mb-2">
              {t('rh.offer.projectRequired')}
                </label>
                <select
                  id="project_id"
                  name="project_id"
                  value={formData.project_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))}
                  disabled={!formData.department_id}
                  className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                    !formData.department_id ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  required
                >
                  <option value="">{t('rh.offer.selectProject')}</option>
                  {filteredProjects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
            {t('rh.offer.countryRequired')}
                </label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-2">
              {t('rh.offer.deadlineRequired')}
                </label>
                <input
                  type="date"
                  id="deadline"
                  name="deadline"
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('rh.offer.notificationEmails')}
              </label>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">
                  {notificationEmails.filter(email => email.trim() !== '').length} of 10 emails
                </span>
                {notificationEmails.length < 10 && (
                  <button
                    type="button"
                    onClick={addEmailField}
                    className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Email
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                {notificationEmails.map((email, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(index, e.target.value)}
                      placeholder={`Enter email address ${index + 1}`}
                      className="flex-1 border-2 border-gray-200 rounded-lg shadow-sm py-2 px-3 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
                    />
                    {notificationEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmailField(index)}
                        className="inline-flex items-center px-2 py-1 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {notificationEmails.length === 10 && (
                <p className="text-sm text-orange-600 bg-orange-50 p-2 rounded-lg">
                  Maximum of 10 notification emails reached
                </p>
              )}
              
              <p className="text-sm text-gray-500">
                These email addresses will be notified when the offer is about to expire.
              </p>
            </div>

            <div>
              <label htmlFor="tdr_file" className="block text-sm font-medium text-gray-700 mb-2">
                TDR File (PDF)
              </label>
              <input
                type="file"
                id="tdr_file"
                name="tdr_file"
                accept=".pdf"
                onChange={(e) => setTdrFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => langNavigate('/rh-dashboard')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Update Offer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OfferEditPage;