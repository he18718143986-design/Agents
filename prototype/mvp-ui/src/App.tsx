import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./pages/AppShell";
import { LandingPage } from "./pages/LandingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app/*" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
