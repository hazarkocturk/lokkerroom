import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import logger from './logger.js';
import sequelize from './config/db.js';
import authRoutes from './routers/auth.js';
import dashRoutes from './routers/dashboard.js';
import {checkUser} from './routers/auth.js';
import methodOverride from 'method-override';
dotenv.config();

const server = express();
server.use(express.static('public'));
server.set('view engine', 'ejs');
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));
server.use(cookieParser());
server.use(methodOverride('_method'));
server.use(logger);
server.use('/api/dash', checkUser, dashRoutes);
server.use('/api/auth', authRoutes);
const PORT = process.env.PORT ;

server.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

sequelize.sync().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});