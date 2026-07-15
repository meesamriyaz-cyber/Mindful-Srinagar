import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { connectDb } from "./config/db.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.use("/api", apiRoutes);
app.use(notFound);
app.use(errorHandler);

connectDb(process.env.MONGO_URI)
  .then(() => {
    const server = app.listen(port, () => console.log(`Mindful API running on port ${port}`));
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Set PORT to another value or stop the existing process.`);
        process.exit(1);
      }

      throw error;
    });
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
