// router/AppRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { PrivateRoute } from "../router/PrivateRoute";  // ← VERIFICA LA RUTA
import { PublicRoute } from "../router/PublicRoute";    // ← VERIFICA LA RUTA

import MainLayout from "../layouts/MainLayout";
import Dashboard from "../views/Dashboard";
import PointOfSale from "../views/PointOfSale";
import { Reception } from "../views/Reception";
import { History } from "../views/History";
import { Inventory } from "../views/Inventory";
import { Config } from "../views/Config";
import { Auth } from "../views/auth/Auth";

export const AppRouter = () => {
  return (
    <Routes>
      {/* 🔐 RUTAS PRIVADAS */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        
        {/* Dashboard - Todos pueden verlo */}
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* POS - Todos pueden verlo */}
        <Route path="pos" element={<PointOfSale />} />
        
        {/* Reception - Todos pueden verlo */}
        <Route path="reception" element={<Reception />} />
        
        {/* History - Todos pueden verlo */}
        <Route path="history" element={<History />} />
        
        {/* Inventory - Todos pueden verlo */}
        <Route path="inventory" element={<Inventory />} />
        
        {/* 👇 SOLO ADMIN puede ver Configuración */}
        <Route 
          path="config" 
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <Config />
            </PrivateRoute>
          } 
        />
      </Route>

      {/* 🌐 AUTH (pública) */}
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        }
      />

      {/* 🚫 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};