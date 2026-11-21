import React, { useEffect, useSyncExternalStore, useState } from 'react';
import { getState, subscribe, update } from './lib/store.js';
import Sidebar from './components/Sidebar.jsx';
import ChatView from './components/ChatView.jsx';
import GraphView from './components/GraphView.jsx';
import PapersView from './components/PapersView.jsx';
import ReportsView from './components/ReportsView.jsx';
import SettingsView from './components/SettingsView.jsx';
import MeView from './components/MeView.jsx';
import Tour, { TOUR_VERSION } from './components/Tour.jsx';
import Onboarding from './components/Onboarding.jsx';
import { fontScaleOf } from './lib/ui.js';

export default function App() {
  const state = useSyncExternalStore(subscribe, getState);
  const [view, setView] = useState('chat');
  const [toast, setToast] = useState('');
  const [manualTutorial, setManualTutorial] = useState(false);

  const notify = (text) => {
    setToast(text);
    window.clearTimeout(notify._t);
    notify._t = window.setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => {
    document.querySelector('.main-area')?.scrollTo({ top: 0 });
  }, [view]);

  const fontSize = state.settings?.ui?.fontSize || 'normal';
  useEffect(() => {
    document.documentElement.style.setProperty('--fs', String(fontScaleOf(fontSize)));
  }, [fontSize]);

  const showTour = !!state.profile && (manualTutorial || !state.meta?.tutorialDone || (state.meta?.tourVersion || 0) < TOUR_VERSION);
  const finishTour = () => {
    update((s) => { s.meta = { ...(s.meta || {}), tutorialDone: true, tourVersion: TOUR_VERSION }; });
    setManualTutorial(false);
  };

  if (!state.profile) {
    return (
      <>
        <Onboarding />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} state={state} />
      <main className="main-area">
        <div className="mobile-bar">
          <div className="mobile-brand">中学知识漏洞图谱</div>
          <div className="mobile-status">{state.settings.ai.enabled ? 'AI' : '离线'}</div>
        </div>
        {view === 'chat' && <ChatView state={state} setView={setView} notify={notify} />}
        {view === 'graph' && <GraphView state={state} setView={setView} />}
        {view === 'papers' && <PapersView state={state} setView={setView} />}
        {view === 'reports' && <ReportsView state={state} setView={setView} />}
        {view === 'me' && <MeView state={state} setView={setView} notify={notify} onOpenTutorial={() => setManualTutorial(true)} />}
        {view === 'settings' && <SettingsView state={state} notify={notify} onBack={() => setView('me')} />}
      </main>
      {showTour && <Tour view={view} setView={setView} onDone={finishTour} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
