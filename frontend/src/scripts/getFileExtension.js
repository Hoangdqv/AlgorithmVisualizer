  const getFileExtension = (languageName) => {
    const extensionMap = {
      'python': 'py',
      'javascript': 'js',
    };
    return extensionMap[languageName.toLowerCase()] || 'txt';
  };

  export default getFileExtension;