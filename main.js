import http from "http";
import { Server } from "socket.io";
import { createSocketHandler } from "./lib/socket-handler.js";
import express from "express";
import cors from "cors";
import { redisClient } from "./lib/redisClient.js";
import * as indexController from "./controllers/indexController.js";

const PORT = process.env.PORT || 4001;

async function main() {
  await redisClient.connect().then(() => console.log("redis connected"));
  const app = express();
  app.use(cors());
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  const socketHandler = createSocketHandler(io);
  io.on("connection", socketHandler);

  app.get("/", indexController.index);
  app.get("/health", indexController.health);
  server.listen(PORT, () => console.log(`app listening on :${PORT}`));
}

main();
