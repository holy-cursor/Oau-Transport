import SuperAdmin from './features/admin/SuperAdmin.jsx';
import Reports from './features/reports/Reports.jsx';
import './features/management.css';
import useTransport from './hooks/useTransport.js';
import Operator from './features/operator/Operator.jsx';
import React, { useState } from 'react';
import { Bus, History, LayoutDashboard, LogOut, MapPin, Menu, Navigation, Radio, RefreshCw, Send, ShieldCheck, X, AlertTriangle, MessageSquare, Settings } from 'lucide-react';
import { transport, client } from './data/index.js';
import { ACTIVE, isOnline } from './domain.js';
import Modal from './components/Modal.jsx';
import DispatchForm from './features/dispatch/DispatchForm.jsx';
import CancelForm from './features/dispatch/CancelForm.jsx';
import Student from './features/student/Student.jsx';
import Driver from './features/driver/Driver.jsx';
import Login from './features/auth/Login.jsx';
const isDemo = transport.mode === 'demo';


export default function App() {
  const { session, role, setRole, data, loading, error, toast, setToast, busy, connected, lastSync, refresh, action: performAction } = useTransport();
  const [page, setPage] = useState('overview'), [selected, setSelected] = useState(null), [modal, setModal] = useState(null), [menu, setMenu] = useState(false);
  async function action(fn, message) {
    const succeeded = await performAction(fn, message);
    if (succeeded) setModal(null);
    return succeeded;
  }
  if (!isDemo && session === undefined) return <div className="loading">Connecting to OAU Transit…</div>;
  if (!isDemo && !session) return <Login error={error} />;
  const activeDispatches = data.dispatches.filter(d => ACTIVE.includes(d.status));
  const available = data.buses.filter(b => b.status === 'available' && isOnline(b) && !activeDispatches.some(d => d.bus_id === b.id));
  const selectedStop = data.stops.find(s => s.id === selected);
  const manager = ['super_admin', 'supervisor'].includes(role);
  const roleName = { super_admin: 'Super admin', supervisor: 'Supervisor', driver: 'Driver', student: 'Student' }[role] || 'Account';
  const nav = manager ? [
    ...(role === 'super_admin' ? [{ id: 'overview', icon: Settings, label: 'Control centre' }, { id: 'operations', icon: LayoutDashboard, label: 'Operations' }] : [{ id: 'overview', icon: LayoutDashboard, label: 'Overview' }]),
    { id: 'fleet', icon: Bus, label: 'Vehicle fleet' }, { id: 'history', icon: History, label: 'Dispatch history' }, { id: 'reports', icon: MessageSquare, label: 'Reports and photos' },
  ] : [{ id: 'overview', icon: role === 'driver' ? Navigation : MapPin, label: role === 'driver' ? 'My shift and requests' : 'Campus stops' }, { id: 'reports', icon: MessageSquare, label: 'Report an issue' }];
  const userId = isDemo ? (role === 'driver' ? 'demo-driver' : role === 'student' ? 'demo-student' : role === 'super_admin' ? 'demo-admin' : 'demo-supervisor') : session?.user.id;

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? 'open' : ''}`}>
      <a href="#" className="brand" onClick={() => setPage('overview')}><span className="brand-icon"><Bus size={23}/></span><span>OAU<span className="brand-light"> Transit</span><small>CAMPUS TRANSPORT</small></span></a>
      <div className="workspace"><span className="workspace-avatar">O</span><div>Obafemi Awolowo University<small>Ile-Ife, Nigeria</small></div></div>
      <p className="nav-label">WORKSPACE</p><nav>{nav.map(n => <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => { setPage(n.id); setMenu(false); }}><n.icon size={18}/>{n.label}{page === n.id && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><Radio size={21}/><strong>Dispatch coordination</strong><p>Live information helps you decide where a shuttle is needed.</p></div><div className="profile"><span className="profile-avatar">{manager ? 'TO' : role === 'driver' ? 'DR' : 'ST'}</span><div>{roleName}<small>{isDemo ? 'Demo workspace' : 'University account'}</small></div>{!isDemo && <button className="icon-button" aria-label="Sign out" onClick={() => client.auth.signOut()}><LogOut size={17}/></button>}</div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><Menu size={20}/></button><span>Workspace</span><span>/</span><strong>{nav.find(n => n.id === page)?.label || 'Overview'}</strong></div><div className="topbar-right">{isDemo && <label className="role-switch">Preview as <select aria-label="Preview role" value={role} onChange={e => { setRole(e.target.value); transport.setPreviewRole?.(e.target.value); setPage('overview'); refresh(); }}><option value="super_admin">Super admin</option><option value="supervisor">Supervisor</option><option value="student">Student</option><option value="driver">Driver</option></select></label>}<span className={`connection ${connected && !error ? '' : 'disconnected'}`}><span/>{!connected ? 'Offline' : error ? 'Reconnecting' : isDemo ? 'Demo mode' : 'Connected'}</span></div></header>
      <main>
        {isDemo && <div className="demo-banner"><span><ShieldCheck size={15}/> Interactive demo · Sample locations and data. No real buses are being dispatched.</span><button onClick={() => { transport.reset(); setToast('Demo data reset.'); }}>Reset demo <RefreshCw size={13}/></button></div>}
        {error && <div className="alert"><AlertTriangle size={18}/><span>{error} · Showing the last successful update.</span><button onClick={refresh}>Retry</button></div>}
        {!connected && <div className="alert">You’re offline. The information below may be out of date.</div>}
        {loading ? <div className="loading">Loading your workspace…</div> : page === 'reports' ? <Reports data={data} role={role} action={action} busy={busy || !connected || !!error}/> : role === 'super_admin' && page === 'overview' ? <SuperAdmin data={data} userId={userId} action={action} busy={busy || !connected || !!error}/> : manager ? <>
          <Operator page={page === 'operations' ? 'overview' : page} data={data} available={available} activeDispatches={activeDispatches} connected={connected} error={error} selected={selected} selectedStop={selectedStop} setSelected={setSelected} setModal={setModal} setPage={setPage} action={action} busy={busy} />
        </> : role === 'student' ? <Student data={data} action={action} busy={busy || !connected || !!error}/> : <Driver data={data} action={action} refresh={refresh} userId={userId}/>}
        <footer className="page-footer"><span><span className="footer-mark">↗</span> OAU Transit</span><span>{lastSync ? `Last synced ${new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for connection'} · OAU Transit</span></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status">{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={17}/></button></div>}
    {modal && <Modal title={modal.type === 'dispatch' ? 'Send a shuttle' : 'Cancel dispatch'} onClose={() => !busy && setModal(null)}>{modal.type === 'dispatch' ? <DispatchForm data={data} available={available} initialStop={modal.stopId} busy={busy} onSubmit={(bus, stop, confirmed) => action(() => transport.dispatch(bus, stop, confirmed), 'Dispatch logged. Call the driver, then record their confirmation.')}/> : <CancelForm busy={busy} onSubmit={reason => action(() => transport.transition(modal.id, 'cancel', reason), 'Dispatch cancelled. You can now assign another bus.')}/>}</Modal>}
  </div>;
}
