import { Request, Response } from 'express';
import prisma from '../prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

//Регистрация пользователя
export const registerUser = async (req: Request, res: Response) => {
  console.log('req', req.body);
  const { name, password, email } = req.body || {};

  if (!name || !password) {
    return res.status(400).json({ message: 'Заполните все обязательные поля' });
  }

  try {
    // Проверяем, есть ли вообще хоть один админ
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    const existingUser = await prisma.user.findUnique({ where: { name } });

    // Проверяем, есть ли уже пользователь с таким именем
    if (existingUser) {
      return res.status(400).json({ message: 'Пользователь уже существует' });
    }

    // Хэшируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Если нет ни одного админа, делаем текущего пользователя админом
    const role = adminCount === 0 ? 'admin' : 'user'; // Или какую роль хочешь по умолчанию

    // Создаем пользователя
    const user = await prisma.user.create({
      data: { name, password: hashedPassword, role: role },
    });

    res.status(201).json({ message: 'Пользователь создан', data: { userId: user.id } });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка регистрации пользователя', data: { error } });
  }
};

// Логин

export const loginUser = async (req: Request, res: Response) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ message: 'Заполните все обязательные поля' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { name } });

    if (!user) {
      return res.status(400).json({ message: 'Неверные учетные данные' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || '');

    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Неверные учетные данные' });
    }

    // Создаем JWT
    const token = jwt.sign({ userId: user.id, name: user.name }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка авторизации на сервере', error });
  }
};
