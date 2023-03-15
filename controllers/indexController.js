const APP_URL = process.env.APP_URL ?? "#";
export const index = async (req, res) => {
  let content = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="X-UA-Compatible" content="IE=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Pair Quest Server</title>
        </head>
        <body>
          <div>
            <h1>Pair Quest Server</h1>
            <p>
              This is the server that powers the multiplayer mode of Pair Quest, a game
              where players try to match pairs.
            </p>
            <p>Play it <a href="${APP_URL}">here</a></p>
          </div>
        </body>
      </html>
      `;
  res.send(content);
};

export const health = async (req, res) => {
  res.status(200).send({ message: "health check" });
};
