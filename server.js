const express = require("express");
const axios = require("axios");
const session = require("express-session");
const bcrypt = require("bcrypt");
const app = express();
const admin = require('firebase-admin');
const serviceAccount = require('./key.json'); // Replace with the path to your service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.set("view engine", "ejs");

// Serve the public folder as static files
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Set up session management
app.use(session({
  secret: 'your-secret-key', // Replace with a strong secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Use true if HTTPS is enabled
}));

// Middleware to check if user is logged in
const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    res.redirect('/login');
  } else {
    next();
  }
};

// Render the login page
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

// Handle login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userRef = db.collection('users').doc(username);
  const doc = await userRef.get();

  if (!doc.exists) {
    res.render("login", { error: "User not registered" });
  } else {
    const user = doc.data();
    const validPassword = await bcrypt.compare(password, user.password);
    if (validPassword) {
      req.session.user = username;
      res.redirect("/");
    } else {
      res.render("login", { error: "Invalid password" });
    }
  }
});

// Render the signup page
app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

// Handle signup
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const userRef = db.collection('users').doc(username);
  const doc = await userRef.get();

  if (doc.exists) {
    res.render("signup", { error: "Username already exists" });
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    await userRef.set({
      password: hashedPassword
    });
    req.session.user = username;
    res.redirect("/login");
  }
});

// Handle logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Handle the /weather route
app.get("/weather", checkAuth, async (req, res) => {
  const city = req.query.city;
  const apiKey = "80d4879d7f7be1e5c6007c69a7952a7e";
  const APIUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=imperial&appid=${apiKey}`;

  let weather = null;
  let error = null;

  try {
    const response = await axios.get(APIUrl);
    weather = response.data;
  } catch (err) {
    if (err.response) {
      error = `Error: ${err.response.data.message}`;
    } else if (err.request) {
      error = "Error: No response from the server. Please try again.";
    } else {
      error = "Error: Unable to fetch weather data. Please try again.";
    }
  }

  res.render("home", { weather, error });
});

// Render the index template with default values for weather and error
app.get("/", checkAuth, (req, res) => {
  res.render("home", { weather: null, error: null });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
