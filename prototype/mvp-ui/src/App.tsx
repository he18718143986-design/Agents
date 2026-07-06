import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { AppShell } from "./pages/AppShell";
import { BetaInvitePage } from "./pages/BetaInvitePage";
import { LandingPage } from "./pages/LandingPage";
import { PrivacyPage, TermsPage } from "./pages/LegalPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app/*" element={<AppShell />} />
      <Route path="/beta" element={<BetaInvitePage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
