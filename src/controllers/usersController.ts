import { Request, Response } from 'express';
import prisma from '../prisma';

export const profileUser = async (req: Request, res: Response) => {
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
