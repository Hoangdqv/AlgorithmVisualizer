import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import CodeEditor from './components/layouts/CodeEditor';
import NavBar from './components/NavBar';
import Home from './components/layouts/Home';
import Error from './components/layouts/Error';
import Terminal from './components/Terminal';
import SignIn from './components/layouts/SignIn';
import SignUp from './components/layouts/SignUp';
import AlgorithmGrid from './components/layouts/CategoryGrid';
import AlgorithmSelect from './components/layouts/AlgorithmSelect';

export default function App() {
  return (
    <AuthProvider>
      <div className="app-layout">
        <NavBar />
        <div className='container'>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/algorithms" element={<AlgorithmGrid />} />
            <Route path="/playground" element={<CodeEditor />} />
            <Route path="/editor" element={<AlgorithmSelect />} />
            <Route path="/terminal" element={<Terminal />} />
            <Route path="/login" element={<SignIn />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/*" element={<Error />} />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
}
