import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import clientPromise from "./src/lib/Mongodb.js";
import { configDotenv } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: "../.env" });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer, {
    cors: {
      origin: "https://notelive.vercel.app", // Adjust if necessary
      methods: ["GET", "POST"],
    },
  });

  // Game area

  const chats = [];
  const players = [];
  let word;
  let drawerindex = 0;
  let timeout;
  let round = 0;
  let playerGuessedRightWord = [];

  const startGame = () => {
    console.log("game started");
    io.emit("game-start", {});
    startTurn();
  };

  const stopGame = () => {
    console.log("game stopped");

    io.emit("game-stop", {});
    drawerindex = 0;
    if (timeout) {
      clearInterval(timeout);
    }
  };

  const startTurn = () => {
    if (drawerindex >= players.length) {
      drawerindex = 0;
    }
    //notify frontend for starting turn with this user
    io.emit("start-turn", players[drawerindex]);
    //word genrator
  };

  const startDraw = () => {
    io.emit("start-draw", players[drawerindex]);
    timeout = setTimeout(() => {
      endTurn();
    }, 60000);
  };

  const endTurn = () => {
    io.emit("end-turn", players[drawerindex]);
    playerGuessedRightWord = [];
    clearInterval(timeout);
    //notify turn ended for this user
    drawerindex = (drawerindex + 1) % players.length;
    //points logic
    startTurn(drawerindex);
  };

  // Game

  io.on("connection", async (socket) => {
    console.log("connected to socket.io");
    console.log("user connected", socket.id);
    // socket.join("room")

    // socket.on("player-joined",(id)=>{
    console.log("player joined with id", socket.id);

    io.to(socket.id).emit("send-user-data", {});

    socket.on("recieve-user-data", ({ username, avatar }) => {
      let newUser = {
        id: socket.id,
        name: username,
        points: 0,
        avatar: avatar,
      };
      players.push(newUser);
      console.log(players);
      io.emit("updated-players", players);
      // })
      if (players.length == 2) {
        startGame();
      }
      if (players.length >= 2) {
        io.emit("game-already-started", {});
      }
    });

    socket.on("sending", (data) => {
      // console.log("msg recievd",data)
      console.log("data received");
      socket.broadcast.emit("receiving", data);
    });

    socket.on("sending-chat", (inputMessage) => {
      const userID = socket.client.sockets.keys().next().value;
      console.log(userID);
      console.log("chat recieved", inputMessage);
      const index = players.findIndex((play) => play.id === userID);
      let rightGuess = false;
      if (
        word &&
        inputMessage &&
        inputMessage.toLowerCase() === word.toLowerCase()
      ) {
        console.log("right guess");
        rightGuess = true;

        if (index > -1) {
          players[index].points += 100;
        }
        chats.push(`${userID} Guessed the right word`);
        // io.to(userID).emit("right-guess")
      } else {
        chats.push(inputMessage);
      }
      let returnObject = {
        msg: inputMessage,
        player: players[index],
        rightGuess: rightGuess,
        players: players,
      };
      io.emit("recieve-chat", returnObject);

      if (rightGuess) {
        let u = playerGuessedRightWord.filter((pla) => pla === userID);
        console.log("u", u);
        if (u.length == 0) {
          playerGuessedRightWord.push(userID);
          if (playerGuessedRightWord.length === players.length - 1) {
            //emit to frontend for pause timer
            io.emit("all-guessed-correct", {});
            playerGuessedRightWord = [];
            endTurn();
          }
        }
      }
    });

    socket.on("word-select", (w) => {
      word = w;
      let wl = w.length;
      io.emit("word-len", wl);
      startDraw();
    });

    const client = await clientPromise;
    const db = client.db("yourDatabase"); // Use your database name

    console.log("New client connected");

    socket.on("join-room", async (roomId) => {
      socket.join(roomId);
      console.log(`User connected to room: ${roomId}`);

      const roomData = await db.collection("rooms").findOne({ roomId });
      if (roomData) {
        socket.emit("room-data", roomData);
      } else {
        // Room doesn't exist, create a new one with a TTL of 2 days
        const room = {
          roomId,
          text: "",
          files: [],
          createdAt: new Date(), // Timestamp to use for TTL
        };

        // Insert new room with TTL
        await db.collection("rooms").insertOne(room);

        // Create TTL index on the 'createdAt' field to automatically delete documents after 2 days
        await db
          .collection("rooms")
          .createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 2 * 24 * 60 * 60 }
          );
      }
    });

    socket.on("text-update", async (roomId, newText) => {
      await db
        .collection("rooms")
        .updateOne({ roomId }, { $set: { text: newText } }, { upsert: true });
      io.in(roomId).emit("receive-text", newText);
    });

    // Handle file uploads, one file per room, delete old file if new one is uploaded
    socket.on("file-upload", async (roomId, fileName, fileData) => {
      const uploadsDir = path.join(__dirname, "/uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, fileName);

      try {
        // Check if the room already exists
        let room = await db.collection("rooms").findOne({ roomId });

        if (!room) {
          // Room doesn't exist, create a new one with a TTL of 2 days
          room = {
            roomId,
            files: [],
            createdAt: new Date(), // Timestamp to use for TTL
          };

          // Insert new room with TTL
          await db.collection("rooms").insertOne(room);

          // Create TTL index on the 'createdAt' field to automatically delete documents after 2 days
          await db
            .collection("rooms")
            .createIndex(
              { createdAt: 1 },
              { expireAfterSeconds: 2 * 24 * 60 * 60 }
            );
        }

        // If there's already a file in the room, delete the old one
        if (room.files && room.files.length > 0) {
          const oldFile = room.files[0]; // Only one file allowed per room

          // Delete the previous file from the filesystem
          const oldFilePath = path.join(__dirname, oldFile.filePath);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath); // Remove the file from the server
          }

          // Remove the file entry from the room in the database
          await db.collection("rooms").updateOne(
            { roomId },
            { $unset: { files: "" } } // Clear the file field
          );
        }

        // Save the new file to the server
        fs.writeFile(filePath, Buffer.from(fileData), async (err) => {
          if (err) {
            console.error("Error saving file:", err);
            socket.emit("file-upload-error", "Error saving the file");
            return;
          }

          // Update the room document with the new file info
          try {
            await db.collection("rooms").updateOne(
              { roomId },
              {
                $set: {
                  files: [{ fileName, filePath: `/uploads/${fileName}` }],
                }, // Replace with the new file
              },
              { upsert: true } // If the document doesn't exist, create a new one
            );

            // Broadcast the new file info to the room
            io.in(roomId).emit("receive-file", {
              fileName,
              filePath: `/uploads/${fileName}`,
            });
          } catch (dbError) {
            console.error("Error updating MongoDB:", dbError);
            socket.emit(
              "file-upload-error",
              "Error updating database with file info"
            );
          }
        });
      } catch (err) {
        console.error("Error during file upload:", err);
        socket.emit("file-upload-error", "Error handling file upload");
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
      console.log(reason);
      console.log("USER DISCONNECTED IN DISCONNECT", socket.id);
      const index = players.findIndex((play) => play.id === socket.id);
      console.log(index);
      if (index > -1) {
        // only splice array when item is found
        players.splice(index, 1); // 2nd parameter means remove one item only
      }
      io.emit("updated-players", players);
      io.to(socket.id).emit("user-disconnected", {});
      if (players.length <= 1) {
        stopGame();
      }
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
