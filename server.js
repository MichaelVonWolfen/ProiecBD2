if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}
const port = 3000;
const path = require('path')
const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')

const server =require("http").createServer(app);
const io = require("socket.io")(server);

const mysql = require('mysql2');
const pool = mysql.createPool(
    {
            host: process.env["DB_HOST"],
            user: process.env["DB_USER"],
            password: process.env["DB_PASSWORD"],
            database: process.env["DB_DATABASE"]
            });
const promisePool = pool.promise();

const initializePassport = require('./passport-config')
initializePassport(
    passport,
    email => GetUserByEmail(email),
    id =>GetUserByID(id)
    // email => users.find(user => user.email === email),
    // id => users.find(user => user.id === id)
    )

// const users = []

app.set('view-engine', 'ejs')
app.use(express.urlencoded({extended:false}))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

app.get('/',checkAuthenticated, async (req, res) => {
    const user = await req.user
    res.render('index.ejs', {name: user.full_name})
    // console.log(user)
})

app.get('/login',checkNotAuthenticated, (req, res) => {
    res.render('login.ejs')
})
app.post('/login', passport.authenticate('local',{
    successRedirect:'/',
    failureRedirect:'/login',
    failureFlash: true
}))
app.get('/register',checkNotAuthenticated, (req, res) => {
    res.render('register.ejs', {error:""})
})
app.post('/register', async (req, res) => {
    try{
        //TODO: Check all the inputs to have text
        let i = 0;
        const hashedPass = await bcrypt.hash(req.body.password, 10)
        const team_name = req.body.team_name
        const fname = req.body.first_name
        const lname = req.body.last_name
        const email = req.body.email
        const phone = req.body.phone
        const college = req.body.college

        const promisePool = pool.promise();
        let [team] = await promisePool.query(`Select name from teams where name like lower('${team_name}')`);
        if(team[0]){
            //DONE: show error message
            return res.render('register.ejs',{error:"Team already exists."});
        }
        //TODO: ADD team in the DB and the members
        let [user] = await promisePool.query(`Select email from users where email like lower('${email}')`)
        if(user[0]){
            return res.render('register.ejs',{error:`Email ${email} already used.`});
        }
        await promisePool.query(`INSERT into teams(NAME, ROLE, CREATEDAT, UPDATEDAT) 
                                VALUES(lower('${team_name}'), 'ROLE_USER', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());`);
        [team] = await promisePool.query(`Select id from teams where name like '${team_name}'`);

        const id = team[0]['id'];
        await promisePool.query(`insert into users(first_name, last_name, email, password, phone, faculty, team_id, role, createdAt, updatedAt)
                                        values ('${fname}', '${lname}', lower('${email}'), '${hashedPass}','${phone}', '${college}','${id}', 'ROLE_USER', current_timestamp, current_timestamp)`);

        res.redirect('/login');

    }catch (e){
        console.error(e)
        res.redirect('/register')
    }
})
app.delete('/logout', async (req, res) => {
    req.logOut()
    res.redirect('/')
})
app.get('/style.css', function(req, res) {
    res.sendFile(__dirname + "/views/css/" + "style.css");
});
app.get('/style_bad.css', function(req, res) {
    res.sendFile(__dirname + "/views/css/" + "style_bad.css");
});
app.get('/admin.js', function(req, res) {
    res.sendFile(__dirname + "/views/js/" + "admin.js");
});
app.get('/user.js', function(req, res) {
    res.sendFile(__dirname + "/views/js/" + "user.js");
});
function checkAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return next()
    }
    res.redirect('/login')
}
function checkNotAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return res.redirect('/')
    }
    next()
}
async function GetUserByEmail(email){
    try {
        const [res] = await promisePool.query(`select id, concat(first_name,' ', last_name) as 'full_name', email, 
                                                    password, phone, faculty, team_id, is_active, role, createdAt, 
                                                    updatedAt from users where email like '${email}';`)
        let user = ExtractUser(res)
        // console.log(user)
        return user
    }catch (e){
        console.log(e)
    }
}
async function GetUserByID(id){
    try {
        const [res] = await promisePool.query(`select id, concat(first_name,' ', last_name) as 'full_name', email, 
                                                    password, phone, faculty, team_id, is_active, role, createdAt, 
                                                    updatedAt  from users where id like '${id}';`)
        let user = ExtractUser(res)
        // console.log(user)
        return user
    }catch (e){
        console.log(e)
    }
}
function ExtractUser(res){
    const user = {
        "id" : res[0]['id'],
        "full_name":  res[0]['full_name'],
        "email":  res[0]['email'],
        "password":  res[0]['password'],
        "phone":  res[0]['phone'],
        "faculty":  res[0]['faculty'],
        "team_id":  res[0]['team_id'],
        "is_active": res[0]['is_active'],
        "role":  res[0]['role']
    }
    return user;
}
async function get_Question() {
    // create the pool
    // now get a Promise wrapped instance of that pool
    const promisePool = pool.promise();
    // query database using promises
    const [quest] = await promisePool.query("select id, question, times_played from  questions\n" +
        "where times_played like (select min(times_played) from questions)\n" +
        "order by RAND()\n" +
        "limit 1;");
    let id = quest[0]['id']
    let question = quest[0]['question']
    let played_times = quest[0]['times_played']

    const [answers] = await promisePool.query(`Select id, answer from answers where question_id = ${id} order by rand()`);
    let question_JSON = {
        'id' : id,
        'question': question,
        'answers': answers
    };
    await promisePool.query(`UPDATE questions set times_played = ${played_times + 1} where id = ${id}`);
    return question_JSON;

}
// Socket IO LOGIC
const workspaces = io.of("/" + /^\/\w+$/);
workspaces.on('connection', socket => {
    const workspace = socket.nsp;
    workspace.on('connection', socket =>{
        console.log(socket.conn.id)
        console.log(socket._rooms)
    })

});
app.get('/user', checkAuthenticated, async (req, res) => {
    let user = await req.user
    let nsp = req.query.namespace
    if(user.role !== 'ROLE_USER'){
        res.redirect('/')
    }
    else{
        res.render('user_room.ejs',{user: user.full_name, namespace:nsp})
    }
})
app.get('/admin', checkAuthenticated, async (req, res) => {
    let user = await req.user
    let nsp = req.query.namespace
    if(!nsp)
        nsp = Date.now() + user.id + Math.floor(Math.random() * 10);

    if(user.role !== 'ROLE_ADMIN'){
        res.redirect('/user')
    }
    else{
        res.render('admin_room.ejs', {namespace: nsp})
    }
})

io.on('connection', (socket) =>{
    console.log(`User connected with id ${socket.conn.id}`)

    // socket.on('message', (msg)=> {
    //     console.log(msg);
    // });
    // socket.on('question', (msg)=>{
    //     get_Question().then(r => io.emit('rasp',r));
    //

    // });

    socket.on('disconnect', () => {
        console.log(`user with id ${socket.conn.id} disconnected`);
    });
});
// END of SOCKET.IO Logic
//
//
// MUST be placed always at the end

app.get('*', function(req, res){
    res.render(__dirname + '/' + 'views' +'/' + "404.ejs")
})
app.post('*', (req, res) => {
    res.render(__dirname + '/' + 'views' +'/' + "404.ejs")
})

server.listen(port, () => {
    console.log(`application is running at: http://localhost:${port}`);
});