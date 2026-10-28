import React from 'react';
import App from './App.jsx';
import Landing from './Landing.jsx';
import { client } from './data/index.js';
import { readAuthRedirect, restoreAuthSession } from './services/authRedirect.js';

const initialRedirect = readAuthRedirect(window.location.href);

export default function Website() {
  const [inApp, setInApp] = React.useState(window.location.hash.startsWith('#app'));
  const [checkingAuth, setCheckingAuth] = React.useState(!!client);
  const [authError, setAuthError] = React.useState('');
  React.useEffect(() => {
    if (!client) return;
    let active = true;
    restoreAuthSession(client.auth, initialRedirect).then(result => {
      if (!active) return;
      setAuthError(result.error);
      if (initialRedirect.isCallback) {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.hash = 'app';
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
        setInApp(true);
      }
      setCheckingAuth(false);
    });
    return () => { active = false; };
  }, []);
  React.useEffect(() => {
    const navigate = () => { setInApp(window.location.hash.startsWith('#app')); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  if (checkingAuth) return <div className="loading">{initialRedirect.isCallback ? 'Finishing your sign-in.' : 'Connecting to OAU Transit.'}</div>;
  return inApp ? <><a className="back-to-home" href="#">Home</a><App authError={authError}/></> : <Landing />;
}
