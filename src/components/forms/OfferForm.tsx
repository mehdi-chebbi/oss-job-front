import { useState, useRef, useEffect } from 'react';
import type { Offer, Department, Project } from '../../types';
import { API_BASE_URL } from '../../config';
import { useI18n } from '../../i18n';

const OfferForm = ({ offer, onSave, onCancel }: { offer?: Offer; onSave: (offer: Offer) => void; onCancel: () => void }) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    type: offer?.type || 'candidature',
    title: offer?.title || '',
    description: offer?.description || '',
    country: offer?.country || '',
    reference: offer?.reference || '',
    deadline: offer?.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tdr: null as File | null,
  });
  
  // Notification emails state
  const [notificationEmails, setNotificationEmails] = useState<string[]>(['']);
  
  // Departments and projects state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Country dropdown state
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [filteredCountries, setFilteredCountries] = useState<string[]>([]);
  const [highlightedCountryIndex, setHighlightedCountryIndex] = useState(-1);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const countryInputRef = useRef<HTMLInputElement>(null);

  // List of countries
  const countries = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", 
    "Antigua and Barbuda", "Argentina", "Armenia", "Australia", 
    "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", 
    "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", 
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", 
    "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", 
    "Cambodia", "Cameroon", "Canada", "Central African Republic", 
    "Chad", "Chile", "China", "Colombia", "Comoros", 
    "Congo, Democratic Republic of the", "Congo, Republic of the", 
    "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", 
    "Czech Republic", "Denmark", "Djibouti", "Dominica", 
    "Dominican Republic", "Ecuador", "Egypt", "El Salvador", 
    "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", 
    "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", 
    "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", 
    "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", 
    "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", 
    "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", 
    "Kazakhstan", "Kenya", "Kiribati", "Korea, North", "Korea, South", 
    "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", 
    "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", 
    "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", 
    "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", 
    "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", 
    "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", 
    "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", 
    "Niger", "Nigeria", "North Macedonia", "Norway", "Oman", 
    "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", 
    "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", 
    "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", 
    "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", 
    "San Marino", "Sao Tome et Principe", "Saudi Arabia", "Senegal", 
    "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", 
    "Slovenia", "Solomon Islands", "Somalia", "South Africa", 
    "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", 
    "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", 
    "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", 
    "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", 
    "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", 
    "United Kingdom", "United States", "Uruguay", "Uzbekistan", 
    "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", 
    "Zambia", "Zimbabwe"
  ];
  
  // Load existing notification emails when editing
  useEffect(() => {
    const loadOfferDetails = async () => {
      if (offer) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/offers/${offer.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          if (response.ok) {
            const offerDetails = await response.json();
            // Parse notification emails if they exist
            if (offerDetails.notification_emails) {
              try {
                const emails = JSON.parse(offerDetails.notification_emails);
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
          } else {
            setNotificationEmails(['']);
          }
        } catch (error) {
          console.error('Error loading offer details:', error);
          setNotificationEmails(['']);
        }
      }
    };
    
    loadOfferDetails();
  }, [offer]);
  
  // Load departments and projects
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        
        // Load departments
        const deptResponse = await fetch(`${API_BASE_URL}/departments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (deptResponse.ok) {
          const deptData = await deptResponse.json();
          setDepartments(deptData);
        }
        
        // Load projects
        const projResponse = await fetch(`${API_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (projResponse.ok) {
          const projData = await projResponse.json();
          setProjects(projData);
        }
      } catch (error) {
        console.error('Error loading departments and projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Handle department selection
  const handleDepartmentChange = (departmentId: string) => {
    setSelectedDepartment(departmentId);
    if (departmentId) {
      const deptProjects = projects.filter(p => p.department_id.toString() === departmentId);
      setFilteredProjects(deptProjects);
    } else {
      setFilteredProjects([]);
    }
  };

  // Set initial department and project when editing
  useEffect(() => {
    if (offer && offer.project_id && departments.length > 0 && projects.length > 0) {
      const project = projects.find(p => p.id === offer.project_id);
      if (project) {
        setSelectedDepartment(project.department_id.toString());
        const deptProjects = projects.filter(p => p.department_id === project.department_id);
        setFilteredProjects(deptProjects);
      }
    }
  }, [offer, departments, projects]);
  
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
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle country input changes
  const handleCountryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, country: value }));
    
    if (value) {
      const filtered = countries.filter(country => 
        country.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCountries(filtered.slice(0, 6)); // Limit to 6 options
      setShowCountryDropdown(true);
    } else {
      // Show first countries when input is empty
      setFilteredCountries(countries.slice(0, 6));
      setShowCountryDropdown(true);
    }
    setHighlightedCountryIndex(-1);
  };
  
  // Handle country key navigation
  const handleCountryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showCountryDropdown) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedCountryIndex(prev => 
          prev < filteredCountries.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedCountryIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (highlightedCountryIndex >= 0) {
          e.preventDefault();
          selectCountry(filteredCountries[highlightedCountryIndex]);
        }
        break;
      case 'Escape':
        setShowCountryDropdown(false);
        break;
      default:
        break;
    }
  };
  
  // Select a country from the dropdown
  const selectCountry = (country: string) => {
    setFormData(prev => ({ ...prev, country }));
    setShowCountryDropdown(false);
    setHighlightedCountryIndex(-1);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countryDropdownRef.current && 
        !countryDropdownRef.current.contains(event.target as Node) && 
        countryInputRef.current !== event.target
      ) {
        setShowCountryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, tdr: e.target.files![0] }));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that a project is selected
    if (!selectedDepartment) {
      alert(t('rh.form.validation.selectDepartment'));
      return;
    }
    
    // Find the selected project (we'll use the first one from filtered projects for now)
    // In a real implementation, you'd have a separate project selection state
    const selectedProject = filteredProjects.length > 0 ? filteredProjects[0] : null;
    if (!selectedProject) {
      alert(t('rh.form.validation.selectProject'));
      return;
    }
    
    // Validate emails before submission
    const validEmails = notificationEmails.filter(email => email.trim() !== '');
    const invalidEmails = validEmails.filter(email => !isValidEmail(email));
    
    if (invalidEmails.length > 0) {
      alert(t('rh.form.validation.validEmails'));
      return;
    }
    
    const token = localStorage.getItem('token');
    const formDataToSend = new FormData();

    Object.entries(formData).forEach(([key, value]) => {
      if (key !== 'tdr' && value != null) {
        formDataToSend.append(key, String(value));
      }
    });
    if (formData.tdr) formDataToSend.append('tdr', formData.tdr);
    
    // Add project_id
    formDataToSend.append('project_id', selectedProject.id.toString());
    
    // Add notification emails (only valid ones)
    formDataToSend.append('notification_emails', JSON.stringify(validEmails));

    const url = offer ? `${API_BASE_URL}/offers/${offer.id}` : `${API_BASE_URL}/offers`;
    const method = offer ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formDataToSend,
      });

      if (response.ok) {
        const result = await response.json();
        onSave(result);
        onCancel();
      } else {
        const errorData = await response.json();
        alert(`${t('rh.form.error.saveOffer')}: ${errorData.error || 'Unknown error'} ❌`);
      }
    } catch (err) {
      console.error('Save error:', err);
      alert(t('rh.form.error.network'));
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
      <div className="space-y-2">
        <label htmlFor="type" className="block text-sm font-semibold text-gray-800 mb-2">{t('rh.form.type')}</label>
        <select
          id="type"
          name="type"
          className="mt-1 block w-full border-2 border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 rounded-lg px-4 py-3 text-gray-700 bg-white transition-all duration-200 hover:border-gray-300 shadow-sm"
          value={formData.type}
          onChange={handleChange}
          required
        >
          <option value="candidature">Candidature</option>
          <option value="manifestation">Manifestation</option>
          <option value="appel_d_offre_service">Appel d'Offre (Service)</option>
          <option value="appel_d_offre_equipement">Appel d'Offre (Equipement)</option>
          <option value="consultation">Consultation</option>
        </select>
      </div>
      
      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-semibold text-gray-800 mb-2">{t('rh.form.title')}</label>
        <input
          type="text"
          id="title"
          name="title"
          className="mt-1 block w-full border-2 border-gray-200 rounded-lg shadow-sm py-3 px-4 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
          value={formData.title}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="reference" className="block text-sm font-semibold text-gray-800 mb-2">{t('rh.form.reference')}</label>
        <input
          type="text"
          id="reference"
          name="reference"
          className="mt-1 block w-full border-2 border-gray-200 rounded-lg shadow-sm py-3 px-4 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
          value={formData.reference}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-semibold text-gray-800 mb-2">{t('rh.form.description')}</label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className="mt-1 block w-full border-2 border-gray-200 rounded-lg shadow-sm py-3 px-4 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300 resize-vertical"
          value={formData.description}
          onChange={handleChange}
          placeholder={t('rh.form.descriptionPlaceholder')}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 relative" ref={countryDropdownRef}>
          <label htmlFor="country" className="block text-sm font-semibold text-gray-800 mb-2">{t('rh.form.country')}</label>
          <input
            ref={countryInputRef}
            type="text"
            id="country"
            name="country"
            className="mt-1 block w-full border-2 border-gray-200 rounded-lg shadow-sm py-3 px-4 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
            value={formData.country}
            onChange={handleCountryChange}
            onKeyDown={handleCountryKeyDown}
            onFocus={() => {
              // Show first countries when focused and empty
              if (!formData.country) {
                setFilteredCountries(countries.slice(0, 6));
                setShowCountryDropdown(true);
              } else {
                // Filter countries if there's already a value
                const filtered = countries.filter(country => 
                  country.toLowerCase().includes(formData.country.toLowerCase())
                );
                setFilteredCountries(filtered.slice(0, 6));
                setShowCountryDropdown(true);
              }
            }}
            placeholder={t('rh.form.countryPlaceholder')}
            required
          />
          
          {showCountryDropdown && filteredCountries.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
              {filteredCountries.map((country, index) => (
                <div
                  key={country}
                  className={`px-4 py-2 cursor-pointer ${
                    index === highlightedCountryIndex 
                      ? 'bg-green-500 text-white' 
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => selectCountry(country)}
                >
                  {country}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <label
            htmlFor="department"
            className="block text-sm font-semibold text-gray-800 mb-2"
          >
            {t('rh.form.departmentRequired')}
          </label>
          <select
            id="department"
            name="department"
            className="mt-1 block w-full border-2 border-gray-200 rounded-lg shadow-sm py-3 px-4 text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
            value={selectedDepartment}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            required
            disabled={isLoading || departments.length === 0}
          >
            <option value="">
              {isLoading ? t('rh.form.loading') : departments.length === 0 ? t('rh.form.noDepartmentsAvailable') : t('rh.form.selectDepartment')}
            </option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          {departments.length === 0 && !isLoading && (
            <p className="text-sm text-gray-500">
              {t('rh.form.noDepartmentsHelp')}
            </p>
          )}
        </div>
        
        <div className="space-y-2">
          <label
            htmlFor="project"
            className="block text-sm font-semibold text-gray-800 mb-2"
          >
            {t('rh.form.projectRequired')}
          </label>
          <select
            id="project"
            name="project"
            className="mt-1 block w-full border-2 border-gray-200 rounded-lg shadow-sm py-3 px-4 text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
            value={filteredProjects.length > 0 ? filteredProjects[0].id : ''}
            onChange={(e) => {
              // Project selection logic - for now we just track the selected project
              const projectId = parseInt(e.target.value);
              const selected = filteredProjects.find(p => p.id === projectId);
              if (selected) {
                // You could store this in state if needed
                console.log('Selected project:', selected);
              }
            }}
            required
            disabled={!selectedDepartment || filteredProjects.length === 0}
          >
            <option value="">
              {!selectedDepartment ? t('rh.form.selectDepartmentFirst') : filteredProjects.length === 0 ? t('rh.form.noProjectsAvailable') : t('rh.form.selectProject')}
            </option>
            {filteredProjects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {selectedDepartment && filteredProjects.length === 0 && (
            <p className="text-sm text-gray-500">
              {t('rh.form.noProjectsHelp')}
            </p>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <label htmlFor="deadline" className="block text-sm font-semibold text-gray-800 mb-2">{t('rh.form.deadline')}</label>
        <input
          type="date"
          id="deadline"
          name="deadline"
          className="mt-1 block w-full border-2 border-gray-200 rounded-lg shadow-sm py-3 px-4 text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
          value={formData.deadline}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="tdr" className="block text-sm font-semibold text-gray-800 mb-2">{t('rh.form.tdrDocument')}</label>
        <input
          type="file"
          id="tdr"
          name="tdr"
          accept=".pdf"
          className="mt-1 block w-full border-2 border-gray-200 rounded-lg shadow-sm py-3 px-4 text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-gray-300"
          onChange={handleFileChange}
        />
        <p className="text-sm text-gray-500">{t('rh.form.tdrOptional')}</p>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-gray-800">{t('rh.form.notificationEmails')}</label>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {t('rh.form.emailsCount', { count: notificationEmails.filter(email => email.trim() !== '').length })}
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
                {t('rh.form.addEmail')}
              </button>
            )}
          </div>
        </div>
        
        <div className="space-y-3">
          {notificationEmails.map((email, index) => (
            <div key={index} className="flex items-center space-x-3">
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(index, e.target.value)}
                placeholder={t('rh.form.emailPlaceholder', { index: index + 1 })}
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
            {t('rh.form.maxEmailsReached')}
          </p>
        )}
        
        <p className="text-sm text-gray-500">
          {t('rh.form.emailsDescription')}
        </p>
      </div>
      
      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t('rh.form.cancel')}
        </button>
        <button
          type="submit"
          className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          {offer ? t('rh.form.updateOffer') : t('rh.form.createOffer')}
        </button>
      </div>
    </form>
  );
};

export default OfferForm;