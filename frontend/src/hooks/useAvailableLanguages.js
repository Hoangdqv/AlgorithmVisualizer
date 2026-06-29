import { useEffect, useMemo, useState } from 'react';

const formatLanguageName = (language) => {
  const name = language || '';
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export default function useAvailableLanguages(initialLanguage = 'Python', { preferFirst = false } = {}) {
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);
  const [languageData, setLanguageData] = useState([]);
  const API_URL = import.meta.env.VITE_API_URL;

  const languages = useMemo(() => (
    languageData.map((lang) => formatLanguageName(lang.language))
  ), [languageData]);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch(`${API_URL}/languages`, { credentials: 'include' });
        if (!response.ok) return;

        const data = await response.json();
        const nextLanguageData = data.languages || [];
        const nextLanguages = nextLanguageData.map((lang) => formatLanguageName(lang.language));

        setLanguageData(nextLanguageData);
        setCurrentLanguage((previousLanguage) => {
          if (preferFirst && nextLanguages.length > 0) {
            return nextLanguages[0];
          }
          return nextLanguages.includes(previousLanguage)
            ? previousLanguage
            : (nextLanguages[0] || previousLanguage);
        });
      } catch (error) {
        console.error('Error fetching languages:', error);
      }
    };

    fetchLanguages();
  }, [API_URL, preferFirst]);

  return {
    currentLanguage,
    setCurrentLanguage,
    languageData,
    languages,
  };
}
