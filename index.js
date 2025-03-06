const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const conn = require("./connector.js");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);


app.get("/", (req, res) => {
    res.sendFile('index.html', { root: __dirname });
})
app.get("/chat", (req, res) => {
    res.sendFile('chat.html', { root: __dirname });
})


// Api to fetch rooms
app.get('/rooms', (req, response) => {
    conn.query("SELECT * FROM rooms", (err, data) => {
        if (err)
            console.error(err);
        else
            response.send({ "mesage": "success", "data": JSON.parse(JSON.stringify(data)) });
    })
});

app.get('/room/chats/:room_id', (req, res) => {
    conn.query("SELECT * FROM users_chat WHERE room_id=?", [req.params.room_id], (err, data) => {
        if (err)
            console.error(err);
        else
            res.send({ "message": "success", "data": JSON.parse(JSON.stringify(data)) });
    })
})

var users = [];

function insertUserIntoRoom(room, user, user_key) {

    const usr = { room, user, user_key }
    users.push(usr);

}

function removeUserFromRoom(indx) {

    if (indx != -1) {
        users.splice(indx, 1)[0]
    }
}

function usersCountInRoom(room) {
    return users.filter(user => user.room == room);
}

function userSearchInRoom(username, room) {
    const curr_user = users.filter(user => user.room == room && user.user == username);
    if (curr_user.length > 0)
        return true;
    else
        return false;
}


io.on("connection", (socket) => {

    
    // Join a user and its logic.
    socket.on("joinRoom", ({ username, room }) => {

        if (userSearchInRoom(username, room)) {
            username = username + '_' + (Math.random() + 1).toString(36).substring(5);

        }
        socket.emit('userName', username);

        conn.query("SELECT * FROM rooms WHERE room_id=?", [room], (err, data) => {
            if (err)
                console.error(err);
            else {
                if (data.length == 0) {
                    conn.query("INSERT INTO rooms(room_id) VALUES(?)", [room], (err, data) => {
                        if (err)
                            console.error(err);
                        else {
                            console.log("1 new room created!");
                        }
                    })
                }
            }
        })

        socket.join(room);
        insertUserIntoRoom(room, username, socket.id);

        socket.on("userNameChanged", (change_status)=>{
            if(change_status == "yes"){
                socket.emit("message", JSON.stringify({
                    "username": "notice_warning",
                    "message": `Username already exist in this room so username changed to <b><i>${username}</i></b>, <br> Remember this username to see your old chats.`,
                    "time": new Date().toLocaleTimeString([], { hour: '2-digit', minute: "2-digit", hour12: false })
                }))
            }else{
                socket.emit("message", JSON.stringify({
                    "username": "notice",
                    "message": "Welcome to the room (" + room + "), the chats are limited to this room only!",
                    "time": new Date().toLocaleTimeString([], { hour: '2-digit', minute: "2-digit", hour12: false })
                }));
            }
        })
        
        socket.emit('message', JSON.stringify({
            "username": "Server",
            "message": `Welcome to the room, ${username}, stay connected and chat!`,
            "time": new Date().toLocaleTimeString([], { hour: '2-digit', minute: "2-digit", hour12: false })
        }))

        socket.to(room).emit('message', JSON.stringify({
            "username": "Server",
            "message": `${username} connected to the room!`,
            "time": new Date().toLocaleTimeString([], { hour: '2-digit', minute: "2-digit", hour12: false })
        }));

        io.to(room).emit("room_users_count", usersCountInRoom(room));
    });



    // Listen for chat messages
    socket.on('chatMessage', (msg) => {
        parsedMsg = JSON.parse(msg);

        const indx = users.findIndex(user => user.user_key == socket.id);
        const curr_usr = users[indx].user;
        const msg_time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: "2-digit", hour12: false });

        // Inserting messages into database.
        conn.query("INSERT INTO users_chat(room_id,user_name,user_message,message_time) VALUES (?,?,?,?)",
            [parsedMsg.room, curr_usr, parsedMsg.message, msg_time],
            (err, data) => {
                if (err)
                    console.error(err);
            });

        socket.emit('message', JSON.stringify({
            "message": `${parsedMsg.message}`,
            "username": `Me`,
            "time": msg_time
        }))

        socket.to(parsedMsg.room).emit('message', JSON.stringify({
            "message": `${parsedMsg.message}`,
            "username": `${curr_usr}`,
            "time": msg_time
        }));
    });


    // Checking for the users is typing or not.
    socket.on("isTyping", ({ username, room }) => {
        socket.to(room).emit("typingStatus", username + " is typing...");
    })

    socket.on("isNotTyping", ({ room }) => {
        socket.to(room).emit("typingStatus", "");
    })


    // Listen for disconnection.
    socket.on('disconnect', () => {
        const indx = users.findIndex(user => user.user_key == socket.id)
        if (indx != -1) {
            const user_name = users[indx].user;
            // console.log(`${user_name} disconnected`);

            io.emit("message", JSON.stringify({
                "username": "Server",
                "message": `${user_name} disconnected!`,
                "time": new Date().toLocaleTimeString([], { hour: '2-digit', minute: "2-digit", hour12: false })
            }));
            const user_room = users[indx].room;
            removeUserFromRoom(indx);
            io.to(user_room).emit("room_users_count", usersCountInRoom(user_room));
        }
    });

})



server.listen("3000", () => {
    console.log("Server started at 3000");
})