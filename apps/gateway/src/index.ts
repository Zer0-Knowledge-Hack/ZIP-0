import dotenv from "dotenv";
import { createApp } from "./app.js";

dotenv.config();

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`[ZIP-0 Gateway] REST API listening on http://localhost:${port}`);
});

export { createApp };
