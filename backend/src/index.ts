import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { charactersRouter } from "./routes/characters.js";
import { itemsRouter } from "./routes/items.js";
import { routesRouter } from "./routes/routes.js";
import { imagesRouter } from "./routes/images.js";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/characters", charactersRouter);
app.use("/api/items", itemsRouter);
app.use("/api/routes", routesRouter);
app.use("/api/images", imagesRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found" });
});

// Express 5 forwards rejected promises from async handlers here, so a DB error
// returns a 500 instead of leaving the request hanging.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
};
app.use(errorHandler);

app.listen(port, () => {
  console.log(`eternal-return backend listening on http://localhost:${port}`);
});
