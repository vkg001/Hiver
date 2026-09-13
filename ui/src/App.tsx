// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages';


function App() {
  return (
    <Router>
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;