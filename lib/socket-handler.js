import { createRoom, loadRoom } from "./room.js";
import { getStats, incrementLinksCreated } from "./stats.js";

export function createSocketHandler(io) {
  return function (socket) {
    socket.on(
      "create_room",
      async ({ numOfPlayers, gridSize, theme, hostClientId }, cb) => {
        const room = await createRoom({
          io,
          numOfPlayers,
          theme,
          gridSize,
          hostClientId,
        });
        cb(room.id);
        incrementLinksCreated(io);
      }
    );

    socket.on("stats", async (cb) => {
      const stats = await getStats();
      cb(stats);
    });

    socket.on("join_room", async (roomId, clientId, cb) => {
      const room = await loadRoom(io, roomId);
      if (!room) {
        cb(null);
        return;
      }
      room.join(socket, clientId, cb);
    });

    socket.on("play", ({ index }) => {
      socket.room.handlePlay(index, socket);
    });

    socket.on("start", () => {
      socket.room.startGame();
    });

    socket.on("restart", () => {
      socket.room.restart();
    });

    socket.on("_gameover", () => {
      socket.room.gameover();
    });

    const handleLeave = () => {
      if (socket.room) {
        socket.room.leave(socket);
      }
    };
    socket.on("leave_room", handleLeave);

    socket.on("disconnect", handleLeave);
  };
}
