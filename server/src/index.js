import cors from "cors";
import express from "express";
import { apiRouter } from "./routes/api.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use("/api", apiRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Something went wrong in the prototype API." });
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Smart Board Organizer API running on http://localhost:${port}`);
  });
}

export default app;
