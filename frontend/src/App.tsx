import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import BrokerPage from "./pages/BrokerPage";
import SignUpPage from "./pages/SignUpPage";
import AdminPage from "./pages/admin/AdminPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import SubBrokerPage from "./pages/SubBrokerPage";
import GroupPage from "./pages/GroupPage";
import TradingPage from "./pages/TradingPage";
import { tradovateWSMultiClient } from "./services/tradovateWsMulti";

// Component to manage connections based on current route
function ConnectionManager() {
  const location = useLocation();
  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;

  useEffect(() => {
    const isTradingOrDashboard = location.pathname === "/trading" || location.pathname === "/dashboard";
    
    if (!user_id) {
      // No user - disconnect everything
      tradovateWSMultiClient.disconnectAll();
      return;
    }

    if (!isTradingOrDashboard) {
      // User is not on TradingPage or DashboardPage - disconnect WebSocket
      console.log(`[ConnectionManager] User left trading/dashboard pages, disconnecting WebSocket`);
      tradovateWSMultiClient.disconnectAll();
    }
    // Note: Reconnection is handled by TradingPage/DashboardPage when they mount
  }, [location.pathname, user_id]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ConnectionManager />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/broker"
            element={
              <ProtectedRoute>
                <BrokerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/broker/:id"
            element={
              <ProtectedRoute>
                <SubBrokerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <AdminPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminProtectedRoute>
                <AdminUsersPage />
              </AdminProtectedRoute>
            }
          />
          <Route path="/group" element={<GroupPage />} />
          <Route path="/trading" element={<TradingPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
