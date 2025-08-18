import { Request, Response } from 'express';
import prisma from '../prisma';

//Создания задачи
export const createTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId; // получаем id из авторизации
    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    const { title, description } = req.body || {};
    if (!title) {
      return res.status(400).json({ message: 'Не указано название задачи' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        userId, // связываем с пользователем
      },
    });

    res.status(201).json({ result: true, message: 'Задача создана', data: task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка создания задачи', error });
  }
};

//Получение задач
export const getTasks = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    const tasks = await prisma.task.findMany({
      where: { userId },
      include: { bugs: true }, // если нужно получить связанные баги
      orderBy: { createdAt: 'desc' },
    });

    res.json({ tasks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка получения задач', error });
  }
};

//Получение задачи
export const getTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const taskId = req.params.id;

    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    if (!taskId) {
      return res.status(400).json({ message: 'Не указан ID задачи' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { bugs: true }, // если нужны баги, иначе убирай
    });

    if (!task || task.userId !== userId) {
      return res.status(404).json({ message: 'Задача не найдена или нет доступа' });
    }

    res.json({ task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка получения задачи', error });
  }
};

//Удаление задачи
export const deleteTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const taskId = req.params.id;

    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    if (!taskId) {
      return res.status(400).json({ message: 'Не указан ID задачи' });
    }

    // Проверяем, что задача существует и принадлежит пользователю
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || task.userId !== userId) {
      return res.status(404).json({ message: 'Задача не найдена или нет доступа' });
    }

    // Удаляем задачу
    await prisma.task.delete({
      where: { id: taskId },
    });

    res.json({ message: 'Задача успешно удалена' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка при удалении задачи', error });
  }
};

// Обновление задачи
export const updateTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const taskId = req.params.id;
    const { title, done } = req.body || {};

    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    if (!taskId) {
      return res.status(400).json({ message: 'Не указан ID задачи' });
    }

    // Проверяем, что задача принадлежит пользователю
    const task = await prisma.task.findUnique({ where: { id: taskId } });

    if (!task || task.userId !== userId) {
      return res.status(404).json({ message: 'Задача не найдена или нет доступа' });
    }

    // Обновляем только те поля, что пришли
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(title !== undefined && { title }),
        ...(done !== undefined && { done }),
      },
    });

    res.json({ message: 'Задача обновлена', data: updatedTask });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка обновления задачи', error });
  }
};
