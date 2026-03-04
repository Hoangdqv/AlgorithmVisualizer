import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="home-container">
      <div className="home-hero">
        <h1 className="home-title">Algorithm Visualization Platform</h1>
        <p className="home-subtitle">
          Learn algorithms interactively through step-by-step visualization
        </p>
      </div>

      <div className="home-content">
        <section className="home-section">
          <h2>What is this platform?</h2>
          <p>
            An educational tool designed to help students and developers understand 
            algorithms through interactive visualization. Watch how sorting, searching, 
            and data structure algorithms work in real-time with clear visual representations.
          </p>
        </section>


        <section className="home-section">
          <h2>Get Started</h2>
          <p>
            Explore algorithm categories and start learning by doing. Each algorithm includes 
            explanations, sample code, and real-time visualization to help you understand 
            how it works.
          </p>
          <div className='home-navigation-links'>
          <Link to="/algorithms" className="home-cta-button">
            Browse algorithm categories
          </Link>
          <Link to="/playground" className="home-cta-button">
            Code in our playground!
          </Link>
          </div>
        </section>

        <section className="home-section">
          <h2>How it works</h2>
          <div className="home-features">
            <div className="home-feature-card">
              <h3>Write & Edit</h3>
              <p>Choose from pre-built algorithms or write your own code in Python or JavaScript</p>
            </div>
            <div className="home-feature-card">
              <h3>Execute Safely</h3>
              <p>Code execution is sandboxed to ensure safety and reliability, through the use of Docker services and Piston API</p>
            </div>
            <div className="home-feature-card">
              <h3>Visualize</h3>
              <p>See each step of the algorithm with color visuals and interactive playback controls</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
