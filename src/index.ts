import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouters from './routes/auth';
import userRouters from './routes/user';
import taskRouters from './routes/task';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', [authRouters, userRouters, taskRouters]);

app.get('/', (req, res) => {
  res.send('Backend is working!');
});

app.listen(port, async () => {
  console.log(`Server is running on http://localhost:${port}`);
});
