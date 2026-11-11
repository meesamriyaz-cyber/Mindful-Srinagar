import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { loadEnv } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";
loadEnv();
const app = express();
const port = process.env.PORT || 5000;
if (process.env.RENDER === "true") app.set("trust proxy", 1);
app.use(helmet());
const allowedOrigins = [
  "https://clientdemo.cuttingedge-enterprises.in", "http://localhost:5173", "http://localhost:3000",
  ...(process.env.CLIENT_ORIGIN || "").split(",").map((origin) => origin.trim().replace(/\/+$/, "")).filter(Boolean)
];
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ""))) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use("/api", apiRoutes);
app.use(notFound);
app.use(errorHandler);
connectDb(process.env.MONGO_URI).then(() => {
  const server = app.listen(port, () => console.log("Mindful API running on port " + port));
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error("Port " + port + " is already in use. Set PORT to another value or stop the existing process.");
      process.exit(1);
    }
    throw error;
  });
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
