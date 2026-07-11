import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import SensorsPage from "./pages/SensorsPage";
import SensorDetailPage from "./pages/SensorDetailPage";
import AlertsPage from "./pages/AlertsPage";
import HistoryPage from "./pages/HistoryPage";
import AdvisoryPage from "./pages/AdvisoryPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/"               element={<DashboardPage />} />
        <Route path="/sensors"        element={<SensorsPage />} />
        <Route path="/sensors/:id"    element={<SensorDetailPage />} />
        <Route path="/alerts"         element={<AlertsPage />} />
        <Route path="/history"        element={<HistoryPage />} />
        <Route path="/advisory"       element={<AdvisoryPage />} />
      </Route>
    </Routes>
  );
}
