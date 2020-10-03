var express = require('express');

var app = express();

var http = require('http').createServer(app);

var io = require("socket.io")(http);




http.listen(4000, () =>{
    console.log("Listening on port 4000");
});

app.use(express.static("public"));


io.on('connection', (socket) => {
    console.log("Connection Established!");
    socket.on('disconnect', ()=>{
        console.log('User disconnected!');
    });
    socket.on('message', (msg)=>{
        console.log(msg);
    });

});
