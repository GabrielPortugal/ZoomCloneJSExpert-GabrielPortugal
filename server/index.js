const server = require("http").createServer((request, response) => {
  response.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
  });
  response.end("hey there!");
});

const socketIo = require("socket.io");
const io = socketIo(server, {
  cors: {
    origin: "*",
    credentials: false,
  },
});

// conexão nova
io.on("connection", (socket) => {
  // socket é a conexão nova
  console.log("conexão", socket.id);
  // este socket fica escutando o join-room
  socket.on("join-room", (roomId, userId) => {
    // add usuario na mesma sala
    socket.join(roomId);
    socket.to(roomId).broadcast.emit("user-connected", userId);
    // socket desconectado chama esta parte
    socket.on("disconnect", () => {
      console.log("saiu da sala", roomId, "usuario", userId);
      socket.to(roomId).broadcast.emit("user-disconnected", userId);
    });
  });
});

const startServer = () => {
  const { address, port } = server.address();
  console.info(`Servidor rodando ${address}:${port}`);
};

server.listen(process.env.PORT || 3000, startServer);
