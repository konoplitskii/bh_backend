import { Request, Response } from 'express';
import prisma from '../prisma';
import { Prisma } from '@prisma/client';

//Получение бага по ID
export const getBug = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const bugId = req.params.id; // получаем id бага из параметров URL

    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    if (!bugId) {
      return res.status(400).json({ message: 'Не указан ID бага' });
    }

    // Ищем баг вместе с задачей, чтобы проверить принадлежность пользователя
    const bug = await prisma.bug.findUnique({
      where: { id: bugId },
      include: {
        task: true, // предполагается, что у тебя в модели Bug есть поле task (связь)
      },
    });

    if (!bug) {
      return res.status(404).json({ message: 'Баг не найден' });
    }

    // Проверяем, что задача, к которой привязан баг, принадлежит текущему пользователю
    if (bug.task.userId !== userId) {
      return res.status(403).json({ message: 'Нет доступа к этому багу' });
    }

    res.json({ data: bug });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка получения бага', error });
  }
};

//Создания бага для задачи
export const createBug = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId; // получаем id из авторизации
    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    const { title, description, taskId } = req.body || {};

    if (!taskId) {
      return res.status(400).json({ message: 'Не указано ID задачи' });
    }

    if (!title) {
      return res.status(400).json({ message: 'Не указано название бага' });
    }

    const bug = await prisma.bug.create({
      data: {
        title,
        taskId,
        description,
      },
    });

    res.status(201).json({ message: 'Баг создан', data: bug });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка создания бага', error });
  }
};

// Удаление бага по ID
export const deleteBug = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const bugId = req.params.id;

    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    if (!bugId) {
      return res.status(400).json({ message: 'Не указан ID бага' });
    }

    // Ищем баг и его задачу
    const bug = await prisma.bug.findUnique({
      where: { id: bugId },
      // include: {
      //   task: true, // нужна, чтобы проверить userId владельца задачи
      // },
    });

    if (!bug) {
      return res.status(404).json({ message: 'Баг не найден' });
    }

    // if (bug.task.userId !== userId) {
    //   return res.status(403).json({ message: 'Нет прав на удаление этого бага' });
    // }

    // Удаляем баг
    await prisma.bug.delete({
      where: { id: bugId },
    });

    res.json({ message: 'Баг успешно удалён' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка при удалении бага', error });
  }
};

// Обновление данных бага по ID
export const updateBug = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const bugId = req.params.id;
    const { title, description, status } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    if (!bugId) {
      return res.status(400).json({ message: 'Не указан ID бага' });
    }

    // Проверяем валидность статуса, если он передан
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Недопустимый статус бага' });
    }

    // Ищем баг и его задачу
    const bug = await prisma.bug.findUnique({
      where: { id: bugId },
      include: {
        task: true,
      },
    });

    if (!bug) {
      return res.status(404).json({ message: 'Баг не найден' });
    }

    if (bug.task.userId !== userId) {
      return res.status(403).json({ message: 'Нет доступа к этому багу' });
    }

    // Формируем объект данных для обновления
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;

    const updatedBug = await prisma.bug.update({
      where: { id: bugId },
      data: updateData,
    });

    res.json({ message: 'Баг обновлён', data: updatedBug });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка при обновлении бага', error });
  }
};

// Получение всех багов  определенной задачи по ID
const allowedStatuses = ['in_progress', 'testing', 'fixed'] as const;

export const getTaskBugs = async (req: Request, res: Response) => {
  console.log('req.query', req.query);

  try {
    const userId = req.user?.userId;
    const taskId = req.params.id;
    const { status, q } = req.query;

    if (!userId) return res.status(401).json({ message: 'Не авторизован' });
    if (!taskId) return res.status(400).json({ message: 'Не указан ID задачи' });

    // проверяем доступ и берём название
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId }, // владелец
          { participants: { some: { userId } } }, // участник
        ],
      },
      select: { id: true, title: true },
    });

    if (!task) {
      return res.status(404).json({ message: 'Задача не найдена или нет доступа' });
    }

    // фильтры
    const where: Prisma.BugWhereInput = { taskId: task.id };

    if (typeof status === 'string') {
      if (!allowedStatuses.includes(status as any)) {
        return res.status(400).json({ message: 'Недопустимый статус бага' });
      }
      where.status = status as any;
    }

    if (typeof q === 'string' && q.trim()) {
      where.title = { contains: q.trim(), mode: 'insensitive' };
    }

    // получаем все баги по задаче
    const bugs = await prisma.bug.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      data: {
        task, // { id, title }
        bugs,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка получения багов задачи', error });
  }
};
