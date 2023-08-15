require('dotenv').config()

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
// const helmet = require('helmet');
// const compression = require('compression');

const session = require('express-session');
const flash = require('connect-flash');

const { auth } = require('express-openid-connect');

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.AUTH0_baseURL,
  clientID: process.env.AUTH0_clientID,
  issuerBaseURL: process.env.AUTH0_issuerBaseURL
};

var indexRouter = require('./routes/index');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(auth(config));
app.use(session({
  secret: process.env.SESSION_SECRET,
  saveUninitialized: false,
  resave: false,
  cookie: {maxAge: 60000}
}));
app.use(flash());
// app.use(helmet( {
//   contentSecurityPolicy: {
//     useDefaults: true,
//     directives: {
//       'script-src': ["'self'", 'https://recordcoasters-staging-be6193363201.herokuapp.com', 'https://recordcoasters-871a1fd5416c.herokuapp.com/']
//     }
//   }
// }));
// app.use(compression());

app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.disable('x-powered-by');

module.exports = app;
