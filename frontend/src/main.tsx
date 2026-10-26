import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import CharactersPage from "./pages/CharactersPage.tsx";
import CharacterDetailPage from "./pages/CharacterDetailPage.tsx";
import ItemsPage from "./pages/ItemsPage.tsx";
import ItemDetailPage from "./pages/ItemDetailPage.tsx";
import MapsPage from "./pages/MapsPage.tsx";
import MapDetailPage from "./pages/MapDetailPage.tsx";
import MonstersPage from "./pages/MonstersPage.tsx";
import MonsterDetailPage from "./pages/MonsterDetailPage.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/characters" replace />} />
          <Route path="characters" element={<CharactersPage />} />
          <Route path="characters/:id" element={<CharacterDetailPage />} />
          <Route path="items" element={<ItemsPage />} />
          <Route path="items/:id" element={<ItemDetailPage />} />
          <Route path="maps" element={<MapsPage />} />
          <Route path="maps/:id" element={<MapDetailPage />} />
          <Route path="monsters" element={<MonstersPage />} />
          <Route path="monsters/:id" element={<MonsterDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
