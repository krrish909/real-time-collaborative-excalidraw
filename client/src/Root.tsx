import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoadingScreen from "./components/LoadingScreen";
import ProtectedRoute from "./components/ProtectedRoute";
import Login     from "./pages/Login";
import Signup    from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Whiteboard from "./pages/Whiteboard";
import NotFound  from "./pages/NotFound";

// Global spinner keyframe (needs to live somewhere in the DOM)
const SpinnerStyle = () => (
  <style>{`
    @keyframes wb-spin {
      to { transform: rotate(360deg); }
    }
  `}</style>
);

export default function Root() {
  const { loading, isAuthenticated } = useAuth();

  // Block render until session is restored from localStorage
  if (loading) return <><SpinnerStyle /><LoadingScreen /></>;

  return (
    <>
      <SpinnerStyle />
      <Routes>
        {/* Public */}
        <Route
          path="/"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <Navigate to="/login"     replace />
          }
        />
        <Route path="/login"  element={<Login />}  />
        <Route path="/signup" element={<Signup />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard"    element={<Dashboard />}  />
          <Route path="/board/:boardId" element={<Whiteboard />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
