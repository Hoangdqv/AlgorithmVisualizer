import { useState } from 'react';
import { algorithmCategories } from '../../data/algorithmCategories';
import '../../styles/index.css';
import { useNavigate } from 'react-router-dom';

const CategoryGrid = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  let navigate = useNavigate();

  const handleSelect = (category) => {
    navigate('/editor?category=' + category.name.toLowerCase());
  };

  return (
    <div className="category-list-container">
      <header className="category-list-header">
        <h1 className="category-list-title">What categories are you looking for?</h1>
      </header>
    
      <main className="category-list-main">
        <div className="category-grid">
          {algorithmCategories.map((category) => (
            <div
              key={category.id}
              className={`category-card ${selectedCategory && selectedCategory.id === category.id ? 'category-card-selected' : ''}`}
              onClick={() => handleSelect(category)}
              onMouseEnter={() => setSelectedCategory(category)}
              onMouseLeave={() => setSelectedCategory(null)}
            >
              <h3 className="category-card-title">
                {category.icon && <span style={{ marginRight: '0.5rem' }}>{category.icon}</span>}
                {category.name}
              </h3>
              <p className="category-description">{category.description}</p>
              <div className="category-card-details">
                <span className="category-badge">{category.category}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default CategoryGrid;