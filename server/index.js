const httpServer = require("http").createServer();

const words = ["networking", "socket", "javascript", "frontend", "backend"];
let gameActive = false;
let hiddenWord = "";
let maskedWord = "";
let guesses = 0;

const io = require("socket.io")(httpServer, {
  cors: {
    origin: "http://localhost:8080",
  },
});

io.use((socket, next) => {
  const username = socket.handshake.auth.username;
  if (!username) {
    return next(new Error("invalid username"));
  }
  socket.username = username;
  next();
});

let adminSocket = null;

// Función para revelar letras en la palabra enmascarada
const revealLetters = (guess) => {
  let updated = false;
  maskedWord = maskedWord
    .split("")
    .map((char, index) => {
      if (hiddenWord[index] === guess && char === "_") {
        updated = true;
        return guess;
      }
      return char;
    })
    .join("");

  return updated;
};

// Función para revelar una letra aleatoria tras varios intentos incorrectos
const revealLetter = () => {
  const indices = [];
  for (let i = 0; i < hiddenWord.length; i++) {
    if (maskedWord[i] === "_") indices.push(i);
  }
  if (indices.length > 0) {
    const randomIndex = indices[Math.floor(Math.random() * indices.length)];
    maskedWord =
      maskedWord.substring(0, randomIndex) +
      hiddenWord[randomIndex] +
      maskedWord.substring(randomIndex + 1);
  }
};

io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.username} (${socket.id})`);

  // Asignar al primer usuario como administrador
  if (!adminSocket) {
    adminSocket = socket;
    socket.emit("set-admin");
    console.log(`Administrador asignado: ${socket.username}`);
  }

  // Enviar la lista de usuarios conectados al nuevo usuario
  const users = Array.from(io.of("/").sockets).map(([id, s]) => ({
    userID: id,
    username: s.username,
  }));
  socket.emit("users", users);

  // Notificar a los demás usuarios sobre la conexión del nuevo usuario
  socket.broadcast.emit("user connected", {
    userID: socket.id,
    username: socket.username,
  });

  // Manejar mensajes grupales
  socket.on("group-message", (message) => {
    io.emit("group-message", { content: message, from: socket.username });

    if (socket === adminSocket && message === "#GAMESTART") {
      console.log("Iniciando juego...");
      hiddenWord = words[Math.floor(Math.random() * words.length)];
      console.log(`Palabra oculta: ${hiddenWord}`);
      maskedWord = "_".repeat(hiddenWord.length);
      gameActive = true;
      console.log("gameActive es true");
      guesses = 0;
      io.emit("group-message", {
        content: `Juego iniciado. Palabra actual: ${maskedWord}`,
        from: "server",
      });

    } else if (message === "#GAMEEND" && socket === adminSocket) {
      console.log("Finalizando juego...");
      gameActive = false;
      io.emit("group-message", {
        content: "El juego ha terminado.",
        from: "server",
      });
      io.emit("game-update", { active: gameActive, word: "" });
    } else {

      if (gameActive === true) {
        console.log(`Intento de adivinar palabra: ${message}`);
        if (message.length === 1) {
          // Si es una letra, intenta revelar en la palabra
          console.log(`Intento de adivinar letra: ${message}`);
          const letter = message.toLowerCase();
          if (hiddenWord.includes(letter)) {
            console.log("Letra correcta");
            const updated = revealLetters(letter);
            if (updated) {
              io.emit("group-message", {
                content: `Palabra actual: ${maskedWord}`,
                from: "server",
              });
            }
          } else {
            guesses++;
            if (guesses >= 3) {
              revealLetter();
              guesses = 0; // Reiniciar los intentos tras revelar
              io.emit("group-message", {
                content: `Nadie acertó. Palabra actual: ${maskedWord}`,
                from: "server",
              });
            }
          }
        } else if (message === hiddenWord) {
          // Si adivina la palabra completa
          gameActive = false;
          io.emit("group-message", {
            content: `${socket.username} adivinó la palabra: ${hiddenWord}`,
            from: "server",
          });
          io.emit("game-update", { active: gameActive, word: "" });
        }
      }

    }
  });

  // Manejar intentos de adivinar palabras o letras
  socket.on("guess-word", ({ word }) => {
    if (gameActive === true) {
      console.log(`Intento de adivinar palabra: ${word}`);
      if (word.length === 1) {
        // Si es una letra, intenta revelar en la palabra
        console.log(`Intento de adivinar letra: ${word}`);
        const letter = word.toLowerCase();
        if (hiddenWord.includes(letter)) {
          console.log("Letra correcta");
          const updated = revealLetters(letter);
          if (updated) {
            io.emit("group-message", {
              content: `Palabra actual: ${maskedWord}`,
              from: "server",
            });
          }
        } else {
          guesses++;
          if (guesses >= 3) {
            revealLetter();
            guesses = 0; // Reiniciar los intentos tras revelar
            io.emit("group-message", {
              content: `Nadie acertó. Palabra actual: ${maskedWord}`,
              from: "server",
            });
          }
        }
      } else if (word === hiddenWord) {
        // Si adivina la palabra completa
        gameActive = false;
        io.emit("group-message", {
          content: `${socket.username} adivinó la palabra: ${hiddenWord}`,
          from: "server",
        });
        io.emit("game-update", { active: gameActive, word: "" });
      }
    }
  });

  // Manejar mensajes privados
  socket.on("private message", ({ content, to }) => {
    socket.to(to).emit("private message", { content, from: socket.username });
  });

  // Manejar desconexión
  socket.on("disconnect", () => {
    console.log(`Usuario desconectado: ${socket.username} (${socket.id})`);
    socket.broadcast.emit("user disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`server listening at http://localhost:${PORT}`)
);
