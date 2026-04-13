import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { AuthProvider, useAuth } from "./app/contexts/AuthContext";
import LoginPage from "./app/components/LoginPage";
import { Loader2 } from "lucide-react";
import "./styles/index.css";

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <AuthGate />
  </AuthProvider>
);
