import express from 'express';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import authRouters from './routes/auth';
import userRouters from './routes/user';
import taskRouters from './routes/task';
import bugRouters from './routes/bug';

const DEV_ORIGIN = process.env.FRONTEND_URL_DEV;
const PROD_ORIGIN = process.env.FRONTEND_URL_PROD;

const whitelist = [DEV_ORIGIN, PROD_ORIGIN];

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Если используешь куки/сессии — очень важно!
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Разрешаем запросы без Origin (например, curl, серверные) и из белого списка
    if (!origin || whitelist.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true, // чтобы браузер отправлял/получал куки
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [], // добавь нужные, если возвращаешь кастомные заголовки
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api', [authRouters, userRouters, taskRouters, bugRouters]);

app.get('/', (req, res) => {
  res.send('Backend is working!');
});

app.listen(port, async () => {
  console.log(`CORS whitelist:`, whitelist);
  console.log(`Server is running on http://localhost:${port}`);
});
