import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/useAuth";
import { ensureRows } from "@/lib/data";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Approvals from "@/pages/Approvals";
import Jobs from "@/pages/Jobs";
import AddJob from "@/pages/AddJob";
import Companies from "@/pages/Companies";
import Answers from "@/pages/Answers";
import ProfilePage from "@/pages/Profile";
import SettingsPage from "@/pages/Settings";

function Gate() {
  const { session, loading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!session) { setReady(false); return; }
    ensureRows(session.user.id, session.user.email ?? "").finally(() => setReady(true));
  }, [session]);

  if (loading) return <div className="p-8 muted">Loading…</div>;
  if (!session) return <Login />;
  if (!ready) return <div className="p-8 muted">Setting up your space…</div>;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="add" element={<AddJob />} />
        <Route path="companies" element={<Companies />} />
        <Route path="answers" element={<Answers />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter><Gate /></BrowserRouter>
    </AuthProvider>
  );
}
