import shortid, { generate } from "shortid";
import { generateBoardItems } from "./utils.js";
import Player from "./Player.js";
import { redisClient } from "./redisClient.js";
import { incrementGamesPlayed } from "./stats.js";

const isProd = () => process.env.NODE_ENV === "production";

class Room {
  constructor({ io, id, numOfPlayers, gridSize, theme, hostClientId }) {
    this.theme = theme;
    this.roomSize = numOfPlayers;
    this.hostClientId = hostClientId;
    this.io = io;
    this.id = id ?? shortid.generate();
    this.players = [];
    this.gridSize = gridSize;
    this.boardItems = this.generateBoardItems();
    this.nextPlayerIndex = 0;
    this.nextPlayer = null;
    this.flippedPair = new Set();
    this.opened = [];
    this.closed = false;
    this.started = false;
  }

  /*
   generate board items with room config
  */
  generateBoardItems() {
    return generateBoardItems(this.gridSize, this.theme);
  }

  /*
    broadcast event to all players in room
  */
  broadcast(event, ...args) {
    this.io.to(this.id).emit(event, ...args);
  }

  resetFlippedPair() {
    this.flippedPair = new Set();
  }

  /*
    room info
  */
  info() {
    return {
      theme: this.theme,
      roomSize: this.roomSize,
      gridSize: this.gridSize,
    };
  }

  _setNextPlayer(index) {
    this.nextPlayerIndex = index;
    this.nextPlayer = this.players[index];
  }

  /*
    reset next player
  */
  resetNextPlayer() {
    this._setNextPlayer(0);
  }

  /*
    determine next player
  */
  updateNextPlayer() {
    let nextIndex = this.nextPlayerIndex;
    if (nextIndex >= this.players.length - 1) {
      nextIndex = 0;
    } else {
      nextIndex += 1;
    }
    this._setNextPlayer(nextIndex);
  }

  /*
     update next player and broadcast
  */
  broadcastNextPlayer() {
    this.updateNextPlayer();
    if (this.nextPlayer) {
      this.broadcast("next_player", this.nextPlayer.id);
    }
  }

  getPlayer(id) {
    return this.players.find((player) => player.id === id);
  }

  /*
    handles player leave
  */
  leave(socket) {
    socket.leave(this.id);
    const leavingPlayer = this.players.find((p) => p.id === socket.id);
    if (leavingPlayer) {
      this.players = this.players.filter(
        (player) => player.id !== leavingPlayer.id
      );
      this.broadcast("player_left", leavingPlayer);
      this.broadcast("update_players", this.players);
      if (this.nextPlayer && this.nextPlayer.id === leavingPlayer.id) {
        this.broadcastNextPlayer();
      }
    }

    if (this.players.length === 0) {
      const roomId = this.id;
      rooms.delete(roomId);
      if (this.started) {
        redisClient.del(`room:${roomId}`);
      }
    }
  }

  handlePlay(index, socket) {
    this.flippedPair.add(index);
    const flippedPair = [...this.flippedPair];
    this.broadcast("update_flipped_pair", flippedPair);

    if (flippedPair.length === 2) {
      let [i, j] = flippedPair;
      let pair1 = this.boardItems[i];
      let pair2 = this.boardItems[j];
      if (pair1 === pair2) {
        this.opened.push(i, j);
        this.resetFlippedPair();
        const player = this.getPlayer(socket.id);
        player.addScore();
        this.broadcast("match_found", {
          opened: this.opened,
          flippedPair: [],
          players: this.players,
        });
        if (this.opened.length === this.boardItems.length) {
          this.broadcast("game_over");
        }
      } else {
        this.resetFlippedPair();
        this.updateNextPlayer();
        this.broadcast("no_match", {
          flippedPair: [],
          nextPlayer: this.nextPlayer?.id,
        });
      }
    }
  }

  resetPlayersScore() {
    this.players.forEach((player) => {
      player.resetScore();
    });
  }

  restart() {
    this.boardItems = this.generateBoardItems();
    this.resetFlippedPair();
    this.resetPlayersScore();
    this.resetNextPlayer();
    this.opened = [];
    this.broadcast("restart", {
      boardItems: this.boardItems,
      nextPlayer: this.nextPlayer?.id,
      players: this.players,
    });
  }

  /*
    game over
  */
  gameover() {
    this.broadcast("game_over");
  }

  /*  
    starts new game
  */
  startGame() {
    this.resetNextPlayer();
    this.boardItems = generateBoardItems(this.gridSize, this.theme);
    this.broadcast("start_game", {
      boardItems: this.boardItems,
      nextPlayer: this.nextPlayer?.id,
    });
    this.started = true;
    // close room to any other connections
    this.closed = true;
    incrementGamesPlayed(this.io);
  }

  /*
    generate new player no
  */
  generateNewPlayerNo() {
    const lastPlayer = this.players[this.players.length - 1];
    if (lastPlayer) {
      return lastPlayer.no + 1;
    }
    return 1;
  }

  /*
    add player joins
  */
  join(socket, clientId, cb) {
    if (this.closed || this.players.length === this.roomSize) {
      return cb(null);
    }

    if (socket.rooms.has(this.id)) {
      // socket already joined
      return cb(null);
    }

    const isHost = this.hostClientId === clientId;

    const player = new Player({
      id: socket.id,
      no: this.generateNewPlayerNo(),
      isHost,
    });

    this.players = this.players.concat(player);

    socket.join(this.id);
    socket.room = this;

    cb({ player, players: this.players, room: this.info() });

    this.broadcast("update_players", this.players);

    // start game automatically when last user joins
    if (this.players.length === this.roomSize) {
      this.startGame();
    }
  }
}

const rooms = new Map();

const EXPIRY_DURATION = 15 * 60; // 5 minutes

async function createRoom({ io, theme, numOfPlayers, gridSize, hostClientId }) {
  const room = new Room({
    io,
    theme,
    numOfPlayers,
    gridSize,
    hostClientId,
  });

  rooms.set(room.id, room);

  // store room in redis
  let roomInfo = {
    theme,
    numOfPlayers,
    gridSize,
    hostClientId,
    id: room.id,
  };
  roomInfo = JSON.stringify(roomInfo);
  const roomKey = `room:${room.id}`;
  await redisClient.setEx(roomKey, EXPIRY_DURATION, roomInfo);
  return room;
}

async function loadRoom(io, roomId) {
  // first of all let's load room from memory
  if (rooms.has(roomId)) {
    return rooms.get(roomId);
  }
  // load room from redis
  const roomInfoKey = `room:${roomId}`;
  let roomInfo = await redisClient.get(roomInfoKey);
  if (roomInfo) {
    const { theme, numOfPlayers, gridSize, hostClientId, id } =
      JSON.parse(roomInfo);
    const room = new Room({
      io,
      id,
      theme,
      numOfPlayers,
      gridSize,
      hostClientId,
    });
    rooms.set(room.id, room);
    return room;
  }
}

export { rooms, createRoom, loadRoom };
