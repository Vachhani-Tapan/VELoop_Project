import React, { useState, useEffect } from 'react';
import DailyStreakPage from './components/DailyStreak/DailyStreakPage';
import Auth from './components/Auth/Auth';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  if (!token) {
    return (
      <div className="app-container">
        <Auth onAuthSuccess={setToken} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <DailyStreakPage onLogout={() => {
        localStorage.removeItem('token');
        setToken(null);
      }} />
    </div>
  );
}

export default App;
