import { useState, useEffect, useMemo } from 'react';
import { algorithmParams } from '../data/algorithmParams';

const MinimalModePanel = ({ category, algorithmKey, onRun, onRunContinue, isRunning, algorithmName, hasTreeSession = false }) => {
  const schema = algorithmParams[category];
  const [formValues, setFormValues] = useState({});
  const canRunContinuously = useMemo(
    () => category === 'trees' && typeof onRunContinue === 'function',
    [category, onRunContinue]
  );
  const shouldShowResetLabel = category === 'trees' && hasTreeSession;
  
  console.log('MinimalModePanel render', { category, algorithmKey, formValues });
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

  const parseFormValues = () => {
    const parsed = {};
    schema.params.forEach((param) => {
      const raw = formValues[param.key];
      // Parse array of integers
      if (param.type === 'array-int') {
        parsed[param.key] = String(raw)
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
      } else if (param.type === 'number' || param.type === 'number-required') {
        if (raw === '' || raw === null || raw === undefined) {
          parsed[param.key] = null;
          return;
        }
        // Parse target as array for multi-value tree operations
        if (param.key === 'target' && ['insert', 'delete', 'search'].includes(parsed.operation)) {
          parsed[param.key] = String(raw)
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n));
          return;
        }
        parsed[param.key] = parseInt(raw, 10) || 0;
      } else {
        parsed[param.key] = raw;
      }
    });
    return parsed;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = parseFormValues();
    onRun(parsed);
  };

  const handleContinueRun = () => {
    if (!canRunContinuously) return;
    const parsed = parseFormValues();
    onRunContinue(parsed);
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
        <h3>Parameters for {algorithmName}</h3>
        <p>Configure the input values and run the algorithm</p>
      </div>

      <form className="minimal-panel-form" onSubmit={handleSubmit}>
        {schema.params.map((param) => {
  if (param.enabledWhen && !param.enabledWhen(formValues)) {
    return null;
  }

  return (
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
      ) : param.type === 'select' ? (
        // Select input for dropdown options
        <select
          id={`param-${param.key}`}
          value={formValues[param.key] ?? ''}
          onChange={(e) => handleChange(param.key, e.target.value)}
          className="minimal-panel-input"
        >
          {param.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        // Default to text input for 'string', 'array-int', 'number-required', etc.
        <input
          id={`param-${param.key}`}
          type="number"
          
          required={param.required}
          value={formValues[param.key] ?? ''}
          onChange={(e) => handleChange(param.key, e.target.value)}
          placeholder={param.placeholder}
          className="minimal-panel-input"
        />
      )}
    </div>
  );
})}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="submit"
            className="minimal-panel-run-btn"
            disabled={isRunning}
          >
            {shouldShowResetLabel ? '↺ Reset and Run Algorithm' : '▶ Run Algorithm'}
          </button>

          {canRunContinuously && (
            <button
              type="button"
              className="minimal-panel-run-btn"
              disabled={isRunning || !hasTreeSession 
                || formValues.operation === 'build'
                || (['insert', 'delete', 'search'].includes(formValues.operation) && (!formValues.target || formValues.target.length === 0))}
              onClick={handleContinueRun}
            >
              ⟳ Run Next Operation
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default MinimalModePanel;
