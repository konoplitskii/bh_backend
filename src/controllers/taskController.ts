import { Request, Response } from 'express';
import prisma from '../prisma';

//Создания задачи
export const createTask1 = async (req: Request, res: Response) => {
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

// Создание задачи + добавление участников (без hidden)
export const createTask = async (req: Request, res: Response) => {
  try {
    const ownerId = req.user?.userId;
    if (!ownerId) return res.status(401).json({ message: 'Не авторизован' });

    const {
      title,
      description = '',
      participantIds = [],
    } = (req.body ?? {}) as {
      title?: string;
      description?: string;
      participantIds?: string[];
    };

    if (!title?.trim()) {
      return res.status(400).json({ message: 'Не указано название задачи' });
    }

    // нормализуем участников: строки, без пустых/дублей, исключаем владельца
    const rawIds = Array.isArray(participantIds) ? participantIds : [];
    const uniqueIds = Array.from(new Set(rawIds.map(String).filter(Boolean))).filter((id) => id !== ownerId);

    // (опц.) проверим, что такие пользователи существуют
    let validIds = uniqueIds;
    if (uniqueIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      const existing = new Set(users.map((u) => u.id));
      validIds = uniqueIds.filter((id) => existing.has(id));
    }

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          title: title.trim(),
          description,
          userId: ownerId,
        },
      });

      if (validIds.length) {
        await tx.taskParticipant.createMany({
          data: validIds.map((uid) => ({ taskId: task.id, userId: uid })),
          skipDuplicates: true,
        });
      }

      // ⚠️ ВАЖНО: тут был include: { members: ... } — нужно participants
      const fullTask = await tx.task.findUnique({
        where: { id: task.id },
        include: {
          user: { select: { id: true, name: true, role: true, jobRole: true } }, // владелец
          participants: {
            include: {
              user: { select: { id: true, name: true, role: true, jobRole: true } }, // данные участника
            },
          },
          bugs: true,
        },
      });

      return fullTask;
    });

    return res.status(201).json({
      result: true,
      message: 'Задача создана',
      data: result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка создания задачи', error });
  }
};

//Получение задач
export const getTasks1 = async (req: Request, res: Response) => {
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

// Получение задач (владелец ИЛИ участник)
// GET /task
// GET /task?status=active|completed|hidden
export const getTasks = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const status = req.query.status as string; // 'active', 'completed', 'hidden'
    if (!userId) return res.status(401).json({ message: 'Не авторизован' });

    const include = {
      user: { select: { id: true, name: true, role: true, jobRole: true } },
      participants: {
        include: {
          user: { select: { id: true, name: true, role: true, jobRole: true } },
        },
      },
      bugs: true,
    } as const;

    const orderBy = { createdAt: 'desc' } as const;

    // Получаем ID всех скрытых задач пользователя
    const hiddenTasks = await prisma.hiddenTask.findMany({
      where: { userId },
      select: { taskId: true },
    });
    const hiddenTaskIds = hiddenTasks.map((ht) => ht.taskId);

    // Базовые условия для задач пользователя
    const userTasksCondition = {
      OR: [
        { userId }, // создатель
        { participants: { some: { userId } } }, // участник
      ],
    };

    let whereCondition: any = {};

    switch (status) {
      case 'completed':
        // Только завершенные задачи (не скрытые)
        whereCondition = {
          ...userTasksCondition,
          done: true,
          id: { notIn: hiddenTaskIds },
        };
        break;

      case 'hidden':
        // Только скрытые задачи
        whereCondition = {
          ...userTasksCondition,
          id: { in: hiddenTaskIds },
        };
        break;

      case 'active':
      default:
        // Активные задачи (не завершенные и не скрытые) - по умолчанию
        whereCondition = {
          ...userTasksCondition,
          done: false,
          id: { notIn: hiddenTaskIds },
        };
        break;
    }

    const tasks = await prisma.task.findMany({
      where: whereCondition,
      include,
      orderBy,
    });

    // Разделяем задачи на созданные и участия
    const result = {
      ownedTasks: tasks.filter((task) => task.userId === userId),
      participatingTasks: tasks.filter((task) => task.userId !== userId),
      hiddenTasks: status === 'hidden' ? tasks : [],
    };

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка получения задач', error });
  }
};

// Получение задачи (доступ: владелец ИЛИ участник)
export const getTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const taskId = req.params.id;

    if (!userId) return res.status(401).json({ message: 'Не авторизован' });
    if (!taskId) return res.status(400).json({ message: 'Не указан ID задачи' });

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId }, // владелец
          { participants: { some: { userId } } }, // участник
        ],
      },
      include: {
        user: { select: { id: true, name: true, role: true, jobRole: true } }, // владелец
        participants: {
          include: {
            user: { select: { id: true, name: true, role: true, jobRole: true } }, // участники
          },
        },
        bugs: true,
      },
    });

    if (!task) {
      // нельзя сказать, не существует ли задача, или нет прав — безопасный ответ
      return res.status(404).json({ message: 'Задача не найдена или нет доступа' });
    }

    return res.json({ task });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка получения задачи', error });
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

export const hideTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const taskId = req.params.id;

    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    // Проверяем что задача существует и пользователь имеет к ней доступ
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId }, // создатель задачи
          { participants: { some: { userId } } }, // участник задачи
        ],
      },
    });

    if (!task) {
      return res.status(404).json({ message: 'Задача не найдена или нет доступа' });
    }

    // Проверяем не скрыта ли уже задача
    const existingHidden = await prisma.hiddenTask.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });

    if (existingHidden) {
      return res.status(400).json({ message: 'Задача уже скрыта' });
    }

    await prisma.hiddenTask.create({
      data: { userId, taskId },
    });

    return res.json({ message: 'Задача скрыта' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка скрытия задачи', error });
  }
};

export const unhideTask = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const taskId = req.params.id;

    if (!userId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    // Проверяем что задача была скрыта этим пользователем
    const hiddenTask = await prisma.hiddenTask.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });

    if (!hiddenTask) {
      return res.status(404).json({ message: 'Задача не была скрыта' });
    }

    await prisma.hiddenTask.delete({
      where: { userId_taskId: { userId, taskId } },
    });

    return res.json({ message: 'Задача показана' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка показа задачи', error });
  }
};
