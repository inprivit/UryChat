const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const fs = require("fs");

const botName = "ChatCord Bot";

let users = [];

// Função para formatar as mensagens
function formatMessage(username, text) {
  return {
    username,
    text,
    time: new Date().toLocaleTimeString(),
  };
}

// Função para adicionar um usuário à sala
function userJoin(id, username, room) {
  const user = { id, username, room };
  users.push(user);
  return user;
}

// Função para remover um usuário da sala
function userLeave(id) {
  const index = users.findIndex((user) => user.id === id);
  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
}

// Função para obter os usuários de uma sala
function getRoomUsers(room) {
  return users.filter((user) => user.room === room);
}

// Função para verificar nomes de usuário duplicados
function isUsernameTaken(username, room) {
  return getRoomUsers(room).some((user) => user.username === username);
}

// Configuração do servidor
app.use(express.static("public"));

// Evento de conexão
io.on("connection", (socket) => {
  console.log("Nova conexão");

  // Evento de entrada na sala
  socket.on("joinRoom", ({ username, room }) => {
    if (isUsernameTaken(username, room)) {
      socket.emit("message", formatMessage(botName, "Nome de usuário já está em uso. Por favor, escolha um nome diferente."));
      return;
    }

    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Welcome current user
    socket.emit("message", formatMessage(botName, "Bem-vindo ao ChatCord!"));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} entrou no chat`)
      );

    // Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });

    // Load saved messages and send to new user
    const filePath = `messages_${room}.txt`;
    if (fs.existsSync(filePath)) {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          console.error(err);
        } else {
          const messages = data.toString().split("\n");
          messages.forEach((message) => {
            if (message !== "") {
              const [username, text] = message.split(": ");
              socket.emit("message", formatMessage(username, text));
            }
          });
        }
      });
    }
  });

  // Evento de envio de mensagem
  socket.on("chatMessage", (message) => {
    const user = users.find((user) => user.id === socket.id);
    if (user) {
      const formattedMessage = formatMessage(user.username, message);
      io.to(user.room).emit("message", formattedMessage);

      // Salvar mensagem em arquivo
      const filePath = `messages_${user.room}.txt`;
      fs.appendFile(filePath, `${formattedMessage.username}: ${formattedMessage.text}\n`, (err) => {
        if (err) {
          console.error(err);
        }
      });
    }
  });

  // Evento de desconexão
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} saiu do chat`)
      );

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

// Iniciar servidor
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});
