import http from "http";
import { Server } from "socket.io";
import { createSocketHandler } from "./lib/socket-handler.js";
import express from "express";
import cors from "cors";

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

const APP_URL = process.env.APP_URL ?? "#";

app.get("/", async (req, res) => {
  try {
    let content = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Memory Server</title>
      </head>
      <body>
        <div>
          <h1>Memory Server</h1>
          <p>
            This is the server that powers the multiplayer mode of memory, a game
            where players try to match pairs.
          </p>
          <p>Play it <a href="${APP_URL}">here</a></p>
        </div>
      </body>
    </html>
    `;
    res.send(content);
  } catch (err) {
    res.status(400);
    res.send(
      `<h3>oops our server is down or something like that. Come back later.</h3>`
    );
  }
});

app.get("/health", (req, res) => {
  res.status(200).send({ message: "health check" });
});

const PORT = process.env.PORT || 4001;

server.listen(PORT, () => console.log(`app listening on :${PORT}`));
