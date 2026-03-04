import { useState, useEffect } from 'react';
import { algorithmParams } from '../data/algorithmParams';

const MinimalModePanel = ({ category, algorithmKey, onRun, isRunning }) => {
  const schema = algorithmParams[category];
  const [formValues, setFormValues] = useState({});

  // Reset form to defaults when the algorithm or category changes
  useEffect(() => {
    if (!schema?.params) return;
    const defaults = {};
    schema.params.forEach((param) => {
      defaults[param.key] =
        param.type === 'array-int' ? param.default.join(', ') : param.default;
    });
    setFormValues(defaults);
  }, [category, algorithmKey, schema]);

  const handleChange = (key, value) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = {};
    schema.params.forEach((param) => {
      const raw = formValues[param.key];
      if (param.type === 'array-int') {
        parsed[param.key] = String(raw)
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
      } else if (param.type === 'number') {
        parsed[param.key] = parseInt(raw, 10) || 0;
      } else {
        parsed[param.key] = raw;
      }
    });
    onRun(parsed);
  };

  if (!schema) {
    return (
      <div className="minimal-panel minimal-panel-empty">
        No parameters available for this category.
      </div>
    );
  }

  return (
    <div className="minimal-panel">
      <div className="minimal-panel-header">
        <h3>Algorithm Parameters</h3>
        <p>Configure the input values and run the algorithm</p>
      </div>

      <form className="minimal-panel-form" onSubmit={handleSubmit}>
        {schema.params.map((param) => (
          <div key={param.key} className="minimal-panel-field">
            <label htmlFor={`param-${param.key}`}>{param.label}</label>
            <span className="minimal-panel-description">{param.description}</span>
            {param.type === 'number' ? (
              <input
                id={`param-${param.key}`}
                type="number"
                min={param.min}
                max={param.max}
                value={formValues[param.key] ?? ''}
                onChange={(e) => handleChange(param.key, e.target.value)}
                className="minimal-panel-input"
              />
            ) : (
              <input
                id={`param-${param.key}`}
                type="text"
                value={formValues[param.key] ?? ''}
                onChange={(e) => handleChange(param.key, e.target.value)}
                placeholder={param.placeholder}
                className="minimal-panel-input"
              />
            )}
          </div>
        ))}

        <button
          type="submit"
          className="minimal-panel-run-btn"
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : '▶ Run Algorithm'}
        </button>
      </form>
    </div>
  );
};

export default MinimalModePanel;
