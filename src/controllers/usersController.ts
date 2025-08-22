import { Request, Response } from 'express';
import prisma from '../prisma';

export const profileUser1 = async (req: Request, res: Response) => {
  try {
    const userData = req.user;
    const userId = userData.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        jobRole: true,
        tasks: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка при получении пользователя', data: { error } });
  }
};

// GET /api/auth/me (пример)
export const profileUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Не авторизован' });

    // 1) базовая инфа о пользователе + счётчики
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        jobRole: true,
        createdAt: true,
        _count: {
          select: {
            tasks: true, // сколько он создал задач
            taskMemberships: true, // сколько участий
          },
        },
      },
    });
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    // 2) задачи, где он СОЗДАТЕЛЬ
    const ownedTasks = await prisma.task.findMany({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, role: true, jobRole: true } }, // владелец (он же)
        participants: {
          include: {
            user: { select: { id: true, name: true, role: true, jobRole: true } },
          },
        },
        bugs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3) задачи, где он УЧАСТНИК (исключим те, что созданы им самим, чтобы не дублировать)
    const participatingTasks = await prisma.task.findMany({
      where: {
        userId: { not: userId },
        participants: { some: { userId } },
      },
      include: {
        user: { select: { id: true, name: true, role: true, jobRole: true } }, // владелец
        participants: {
          include: {
            user: { select: { id: true, name: true, role: true, jobRole: true } },
          },
        },
        bugs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4) итоговый ответ
    return res.json({
      ...user,
      ownedTasks,
      participatingTasks,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка при получении пользователя', data: { error } });
  }
};

// Получение пользователей, кроме админа
export const getUsers = async (req: Request, res: Response) => {
  try {
    const meId = req.user?.userId;
    if (!meId) return res.status(401).json({ message: 'Не авторизован' });

    const users = await prisma.user.findMany({
      where: {
        role: { not: 'admin' }, // исключаем админов
        // если нужно исключить ТЕКУЩЕГО пользователя из списка:
        id: { not: meId },
      },
      select: {
        id: true,
        name: true,
        role: true,
        jobRole: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка при получении пользователей', data: { error } });
  }
};
