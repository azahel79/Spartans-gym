import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { PrivateRoute } from "../router/PrivateRoute";
import { PublicRoute } from "../router/PublicRoute";
import { useAuthStore } from "../store/auth.store";

const MainLayout = lazy(() => import("../layouts/MainLayout"));
const Dashboard = lazy(() => import("../views/Dashboard"));
const PointOfSale = lazy(() => import("../views/PointOfSale"));
const Reception = lazy(() => import("../views/Reception").then((module) => ({ default: module.Reception })));
const History = lazy(() => import("../views/History").then((module) => ({ default: module.History })));
const Inventory = lazy(() => import("../views/Inventory").then((module) => ({ default: module.Inventory })));
const Config = lazy(() => import("../views/Config").then((module) => ({ default: module.Config })));
const CashClosing = lazy(() => import("../views/CashClosing").then((module) => ({ default: module.CashClosing })));
const Auth = lazy(() => import("../views/auth/Auth").then((module) => ({ default: module.Auth })));
const Training = lazy(() => import("../views/Training").then((module) => ({ default: module.Training })));

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface">
    <div className="rounded-3xl border border-outline-variant bg-white px-6 py-5 text-center shadow-sm dark:bg-slate-900">
      <span className="material-symbols-outlined animate-pulse text-4xl text-primary">progress_activity</span>
      <p className="mt-2 text-sm font-black">Cargando módulo...</p>
    </div>
  </div>
);

const HomeRedirect = () => {
  const { user } = useAuthStore();
  return <Navigate to={user?.role === 'entrenador' ? '/training' : '/dashboard'} replace />;
};

export const AppRouter = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard" element={<PrivateRoute allowedRoles={['admin', 'recepcionista']}><Dashboard /></PrivateRoute>} />
          <Route path="pos" element={<PrivateRoute allowedRoles={['admin', 'recepcionista']}><PointOfSale /></PrivateRoute>} />
          <Route path="reception" element={<PrivateRoute allowedRoles={['admin', 'recepcionista']}><Reception /></PrivateRoute>} />
          <Route path="cash-closing" element={<PrivateRoute allowedRoles={['admin', 'recepcionista']}><CashClosing /></PrivateRoute>} />
          <Route path="history" element={<PrivateRoute allowedRoles={['admin', 'recepcionista']}><History /></PrivateRoute>} />
          <Route path="inventory" element={<PrivateRoute allowedRoles={['admin', 'recepcionista']}><Inventory /></PrivateRoute>} />
          <Route path="training" element={<PrivateRoute allowedRoles={['admin', 'entrenador']}><Training /></PrivateRoute>} />
          <Route path="config" element={<PrivateRoute allowedRoles={['admin']}><Config /></PrivateRoute>} />
        </Route>

        <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
