const CompileBtn = ({runCode, isRunning, loading}) => {
  return (
    <button 
        onClick={runCode} 
        disabled={isRunning || loading}
        className='compile-button'
        style={{
        backgroundColor: isRunning ? '#666' : '#4CAF50',
        cursor: isRunning ? 'not-allowed' : 'pointer',
        }}
    >
        {isRunning ? 'Running...' : '▶ Run Code'}
    </button>
  )
}

export default CompileBtn;