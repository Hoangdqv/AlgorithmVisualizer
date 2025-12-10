const SearchBar = ({ value, onChange, placeholder = "Search samples..." }) => {
  return (
    <div className="search-bar-container">
      <input
        type="text"
        className="search-bar-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button 
          className="search-bar-clear"
          onClick={() => onChange('')}
          title="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default SearchBar;
