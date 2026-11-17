import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Playground from './pages/Playground';
import Simulator from './pages/Simulator';
import Policies from './pages/Policies';
import Permissions from './pages/Permissions';
import Approvals from './pages/Approvals';
import SecurityLogs from './pages/SecurityLogs';
import Settings from './pages/Settings';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-full grid place-items-center"><Spinner /></div>;
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="playground" element={<Playground />} />
        <Route path="simulator" element={<Simulator />} />
        <Route path="policies" element={<Policies />} />
        <Route path="permissions" element={<Permissions />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="logs" element={<SecurityLogs />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
