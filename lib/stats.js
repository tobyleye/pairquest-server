import { redisClient } from "./redisClient.js";

const gamesPlayedKey = "stats:gamesPlayed";
const linksCreatedKey = "stats:linksCreated";

export const incrementGamesPlayed = async (io) => {
  const gamesPlayed = await redisClient.incr(gamesPlayedKey);
  io.emit("stats", { gamesPlayed });
};

export const incrementLinksCreated = async (io) => {
  const linksCreated = await redisClient.incr(linksCreatedKey);
  io.emit("stats", { linksCreated });
};

export const getStats = async () => {
  const gamesPlayed = await redisClient.get(gamesPlayedKey);
  const linksCreated = await redisClient.get(linksCreatedKey);
  return {
    gamesPlayed,
    linksCreated,
  };
};
