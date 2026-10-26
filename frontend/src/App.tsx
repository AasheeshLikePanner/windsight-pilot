import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { AccuracyLab } from "./pages/AccuracyLab";
import { DecisionRoom } from "./pages/DecisionRoom";
import { Methodology } from "./pages/Methodology";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DecisionRoom />} />
        <Route path="accuracy" element={<AccuracyLab />} />
        <Route path="methodology" element={<Methodology />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
