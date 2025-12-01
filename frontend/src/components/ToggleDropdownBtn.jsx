const ToggleDropdownBtn = ({toggleDropdown, isOpen, loading, selectedLanguage}) => {
  return (
    <button 
    className="select-button"
    onClick={toggleDropdown}
    aria-expanded={isOpen}
    disabled={loading}
    >
    <span className="selected-value">
        {selectedLanguage}
    </span>
    <span className={`arrow ${isOpen ? 'rotate' : ''}`}></span>
    </button>
  )
}

export default ToggleDropdownBtn;