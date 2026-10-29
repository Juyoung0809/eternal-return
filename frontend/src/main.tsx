import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import CharactersPage from "./pages/CharactersPage.tsx";
import CharacterDetailPage from "./pages/CharacterDetailPage.tsx";
import ItemsPage from "./pages/ItemsPage.tsx";
import RoutesPage from "./pages/RoutesPage.tsx";
import RouteDetailPage from "./pages/RouteDetailPage.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/characters" replace />} />
          <Route path="characters" element={<CharactersPage />} />
          <Route path="characters/:id" element={<CharacterDetailPage />} />
          <Route path="items" element={<ItemsPage />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="routes/:id" element={<RouteDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
