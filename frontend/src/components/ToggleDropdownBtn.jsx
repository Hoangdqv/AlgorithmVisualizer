const ToggleDropdownBtn = ({toggleDropdown, isOpen, loading, currentLanguage}) => {
  return (
    <button 
    className="select-button"
    onClick={toggleDropdown}
    aria-expanded={isOpen}
    disabled={loading}
    >
    <span className="selected-value">
        {currentLanguage}
    </span>
    <span className={`arrow ${isOpen ? 'rotate' : ''}`}></span>
    </button>
  )
}

export default ToggleDropdownBtn;