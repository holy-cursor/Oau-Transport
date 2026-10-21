import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Landing from './Landing.jsx';
import './styles.css';
function Website() {
  const [inApp, setInApp] = React.useState(window.location.hash.startsWith('#app'));
  React.useEffect(() => {
    const navigate = () => { setInApp(window.location.hash.startsWith('#app')); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  return inApp ? <><a className="back-to-home" href="#">← Home</a><App /></> : <Landing />;
}
createRoot(document.getElementById('root')).render(<Website />);
