import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useUserStore } from './stores/userStore';
import { Layout } from './components/Layout';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { AssetDetail } from './pages/AssetDetail';
import { Activity } from './pages/Activity';
import { Learn, LessonView } from './pages/Learn';
import { Insights } from './pages/Insights';
import { Profile } from './pages/Profile';

// ---------------------------------------------------------------------------
// Routing. HashRouter so the built app works from any static host (GitHub
// Pages included) without server-side rewrite rules — a deliberate choice
// for a portfolio project that must "just work" when someone opens it.
//
// The onboarding gate: until the user finishes the intro flow, every route
// redirects to /onboarding; afterwards, /onboarding redirects home.
// ---------------------------------------------------------------------------

export default function App() {
  const onboarded = useUserStore((s) => s.onboarded);

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {!onboarded ? (
          <>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        ) : (
          <>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/asset/:symbol" element={<AssetDetail />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/learn/:id" element={<LessonView />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </HashRouter>
  );
}
