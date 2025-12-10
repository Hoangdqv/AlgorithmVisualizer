const ToggleSideBarBtn = ({toggleSidebar, showSidebar}) => {
  return (
    <button
        onClick={toggleSidebar}
        className='showfile-button'
    >
        {showSidebar ? '✕ Close' : '☰ Files'}
    </button>
  )
}

export default ToggleSideBarBtn;