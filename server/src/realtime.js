let io;

export function attachRealtime(server, corsOrigin) {
  return import("socket.io").then(({ Server }) => {
    io = new Server(server, {
      cors: { origin: corsOrigin, credentials: true }
    });

    io.on("connection", (socket) => {
      socket.on("presence:join", (user) => {
        socket.join(user.id);
        io.emit("presence:update", { userId: user.id, name: user.name, status: "online" });
      });
    });

    return io;
  });
}

export function emit(event, payload) {
  if (io) io.emit(event, payload);
}

export function emitTo(userId, event, payload) {
  if (io) io.to(userId).emit(event, payload);
}
