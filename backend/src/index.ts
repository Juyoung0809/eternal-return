import "dotenv/config";
import express from "express";
import cors from "cors";
import { charactersRouter } from "./routes/characters.js";
import { itemsRouter } from "./routes/items.js";
import { mapsRouter } from "./routes/maps.js";
import { monstersRouter } from "./routes/monsters.js";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/characters", charactersRouter);
app.use("/api/items", itemsRouter);
app.use("/api/maps", mapsRouter);
app.use("/api/monsters", monstersRouter);

app.listen(port, () => {
  console.log(`eternal-return backend listening on http://localhost:${port}`);
});
