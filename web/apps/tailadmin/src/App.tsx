import { rememberTemplate } from "@fyblue/core";
import { useEffect } from "react";
import { Route, BrowserRouter as Router, Routes, useLocation } from "react-router";
import RequireAuth from "./components/fyblue/RequireAuth";
import AppLayout from "./layout/AppLayout";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import EndpointDetail from "./pages/Epias/EndpointDetail";
import Endpoints from "./pages/Epias/Endpoints";
import EpiasDashboard from "./pages/Epias/EpiasDashboard";
import Formulas from "./pages/Epias/Formulas";
import NotFound from "./pages/OtherPage/NotFound";
import History from "./pages/Osos/History";
import Jobs from "./pages/Osos/Jobs";
import Query from "./pages/Osos/Query";
import Weather from "./pages/Osos/Weather";
import Overview from "./pages/Overview";
import Connections from "./pages/Settings/Connections";
import Profile from "./pages/Settings/Profile";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Bu şablon açıldıysa kullanıcı onu seçmiştir; kök adres (/) bir dahaki sefere buraya yönlenir.
rememberTemplate("tailadmin");

export default function App() {
  return (
    <Router basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <ScrollToTop />
      <Routes>
        {/* Dashboard Layout */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index path="/" element={<Overview />} />

          <Route path="/osos/query" element={<Query />} />
          <Route path="/osos/history" element={<History />} />
          <Route path="/osos/jobs" element={<Jobs />} />
          <Route path="/osos/weather" element={<Weather />} />

          <Route path="/epias" element={<EpiasDashboard />} />
          <Route path="/epias/endpoints" element={<Endpoints />} />
          <Route path="/epias/endpoints/:key" element={<EndpointDetail />} />
          <Route path="/epias/formulas" element={<Formulas />} />

          <Route path="/settings/connections" element={<Connections />} />
          <Route path="/settings/profile" element={<Profile />} />
        </Route>

        {/* Auth Layout */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Fallback Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
