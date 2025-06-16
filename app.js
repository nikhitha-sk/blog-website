const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();


const User = require('./models/User');
const Blog = require('./models/Blog');

const app = express();

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});


app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.userId;
    next();
});

function isLoggedIn(req, res, next) {
    if (!req.session.userId) return res.redirect('/login');
    next();
}

// Routes
app.get('/', async (req, res) => {
    const perPage = 5;
    const page = parseInt(req.query.page) || 1;
    const blogs = await Blog.find()
        .sort({ createdAt: -1 })
        .skip(perPage * (page - 1))
        .limit(perPage)
        .populate('author')
        .populate('comments.author');
    const count = await Blog.countDocuments();
    res.render('index', { blogs, current: page, pages: Math.ceil(count / perPage) });
});

app.get('/blogs/new', isLoggedIn, (req, res) => res.render('new'));

app.post('/blogs', isLoggedIn, async (req, res) => {
    const blog = new Blog(req.body);
    blog.author = req.session.userId;
    await blog.save();
    res.redirect('/');
});

app.get('/blogs/:id/edit', isLoggedIn, async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    res.render('edit', { blog });
});

app.put('/blogs/:id', isLoggedIn, async (req, res) => {
    await Blog.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/');
});

app.delete('/blogs/:id', isLoggedIn, async (req, res) => {
    await Blog.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

app.post('/blogs/:id/comments', isLoggedIn, async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    blog.comments.push({
        text: req.body.comment,
        author: req.session.userId
    });
    await blog.save();
    res.redirect('/');
});

app.post('/blogs/:id/like', isLoggedIn, async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    const liked = blog.likes.includes(req.session.userId);
    if (liked) blog.likes.pull(req.session.userId);
    else blog.likes.push(req.session.userId);
    await blog.save();
    res.redirect('/');
});

app.get('/register', (req, res) => res.render('register'));
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();
    req.session.userId = user._id;
    res.redirect('/');
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await user.matchPassword(password)) {
        req.session.userId = user._id;
        res.redirect('/');
    } else res.send('Invalid credentials');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.listen(3000, () => console.log('Server started on http://localhost:3000'));
