import mongoose from "mongoose";

function explainConnectionError(error, uri) {
  if (error.code === "ECONNREFUSED" || error.message.includes("ECONNREFUSED")) {
    return "MongoDB connection refused. Start MongoDB locally or set MONGO_URI to a reachable database.";
  }

  if (error.code === "ETIMEOUT" || error.code === "ENOTFOUND" || error.message.includes("querySrv")) {
    const isSrvUri = uri.startsWith("mongodb+srv://");
    return isSrvUri
      ? "MongoDB Atlas SRV lookup failed. Check your internet/DNS access, Atlas hostname, and use a mongodb:// URI for local development."
      : "MongoDB host lookup failed. Check MONGO_URI and network/DNS access.";
  }

  return error.message;
}

export async function connectDb(uri) {
  if (!uri) {
    throw new Error("MONGO_URI is required");
  }

  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
  } catch (error) {
    throw new Error(explainConnectionError(error, uri));
  }
}
