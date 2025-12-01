const BackBtn = ({ onBack }) => {
  if (!onBack) return null;

  return (
    <button 
      onClick={onBack}
      className="back-button"
      title="Back to Algorithm Selection"
    >
        Back
    </button>
  );
};

export default BackBtn;
