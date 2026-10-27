import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { LoadingBlock } from "./components/States";

const DecisionRoom = lazy(async () => ({
  default: (await import("./pages/DecisionRoom")).DecisionRoom,
}));
const AccuracyLab = lazy(async () => ({
  default: (await import("./pages/AccuracyLab")).AccuracyLab,
}));
const Methodology = lazy(async () => ({
  default: (await import("./pages/Methodology")).Methodology,
}));

function RouteFallback() {
  return (
    <div className="route-fallback">
      <LoadingBlock lines={10} />
    </div>
  );
}

function page(children: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={page(<DecisionRoom />)} />
        <Route path="accuracy" element={page(<AccuracyLab />)} />
        <Route path="methodology" element={page(<Methodology />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
