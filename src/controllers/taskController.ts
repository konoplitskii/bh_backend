import { Request, Response } from 'express';
import prisma from '../prisma';
import path from 'path';
import fs from 'fs';
import { deleteTaskFilesFromFS } from '../utils/deleteTaskFilesFromFS';

const tasksUploadDir = path.join(process.cwd(), 'uploads', 'tasks');

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
  console.log('req.body:', req.body);
  console.log('req.files:', req.files);

  try {
    const ownerId = req.user?.userId;
    if (!ownerId) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    // Получаем данные из formData
    const { title, description = '', linkDesign = '', linkJira = '', participantIds = [] } = req.body;

    // Проверяем обязательные поля
    if (!title?.trim()) {
      // Удаляем временные файлы если ошибка валидации
      if (req.files) {
        req.files.forEach((file) => {
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch (err) {
            console.error('Ошибка удаления временного файла:', err);
          }
        });
      }
      return res.status(400).json({ message: 'Не указано название задачи' });
    }

    // Обрабатываем participantIds (может быть массивом или строкой)
    let participantIdsArray: string[] = [];
    if (Array.isArray(participantIds)) {
      participantIdsArray = participantIds;
    } else if (typeof participantIds === 'string' && participantIds) {
      participantIdsArray = [participantIds];
    }

    // Убираем дубли и пустые значения, исключаем владельца
    const uniqueIds = Array.from(new Set(participantIdsArray.map((id) => id.toString().trim()).filter((id) => id && id !== ownerId)));

    // Проверяем существование пользователей
    let validParticipantIds: string[] = [];
    if (uniqueIds.length > 0) {
      const existingUsers = await prisma.user.findMany({
        where: {
          id: { in: uniqueIds },
          // Дополнительная проверка что пользователь не удален и т.д.
        },
        select: { id: true },
      });
      validParticipantIds = existingUsers.map((user) => user.id);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Создаем задачу
      const task = await tx.task.create({
        data: {
          title: title.trim(),
          description: description || '',
          linkDesign: linkDesign || '',
          linkJira: linkJira || '',
          userId: ownerId,
        },
      });

      // 2. Добавляем участников если есть
      if (validParticipantIds.length > 0) {
        await tx.taskParticipant.createMany({
          data: validParticipantIds.map((userId) => ({
            taskId: task.id,
            userId: userId,
          })),
          skipDuplicates: true,
        });
      }

      // 3. Обрабатываем файлы если есть
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const mediaData = [];

        for (const file of req.files) {
          // Определяем тип медиа по MIME type
          const getMediaType = (mimetype: string) => {
            if (mimetype.startsWith('image/')) return 'IMAGE';
            if (mimetype.startsWith('video/')) return 'VIDEO';
            if (mimetype.startsWith('audio/')) return 'AUDIO';
            if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('text')) return 'DOCUMENT';
            return 'OTHER';
          };

          // Новое имя файла с ID задачи
          const timestamp = Date.now();
          const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
          const newFilename = `${task.id}_${timestamp}_${safeName}`;
          const newPath = path.join(tasksUploadDir, newFilename);

          try {
            // Переименовываем файл
            if (fs.existsSync(file.path)) {
              fs.renameSync(file.path, newPath);

              mediaData.push({
                url: newFilename, // сохраняем только имя файла
                type: getMediaType(file.mimetype),
                name: file.originalname,
                size: file.size,
                taskId: task.id,
              });
            }
          } catch (error) {
            console.error('Ошибка переименования файла:', error);
            // Удаляем временный файл если ошибка
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }

        // Сохраняем медиа в БД
        if (mediaData.length > 0) {
          await tx.taskMedia.createMany({
            data: mediaData,
          });
        }
      }

      // 4. Получаем полную задачу с отношениями
      const fullTask = await tx.task.findUnique({
        where: { id: task.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              jobRole: true,
            },
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                  jobRole: true,
                },
              },
            },
          },
          media: true,
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
    console.error('Ошибка создания задачи:', error);

    // Удаляем временные файлы если ошибка
    if (req.files) {
      req.files.forEach((file) => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (err) {
          console.error('Ошибка удаления временного файла:', err);
        }
      });
    }

    return res.status(500).json({
      message: 'Ошибка создания задачи',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
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

    // await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 секунды

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
        user: { select: { id: true, name: true, role: true, jobRole: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, role: true, jobRole: true } },
          },
        },
        media: {
          // Все файлы задачи
          orderBy: { createdAt: 'desc' }, // Сортировка по дате
        },
        bugs: true,
      },
    });

    if (!task) {
      return res.status(404).json({ message: 'Задача не найдена или нет доступа' });
    }

    // Форматируем URL для всех файлов
    const taskWithFileUrls = {
      ...task,
      media: task.media.map((mediaItem) => ({
        id: mediaItem.id,
        url: `/uploads/tasks/${mediaItem.url}`, // Прямой путь к статике
        type: mediaItem.type,
        name: Buffer.from(mediaItem.name, 'latin1').toString('utf8'),
        size: mediaItem.size,
        createdAt: mediaItem.createdAt,
      })),
    };

    return res.json({
      task: taskWithFileUrls,
      filesCount: task.media.length, // Количество файлов для информации
    });
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

    // Используем транзакцию для атомарности
    const result = await prisma.$transaction(async (tx) => {
      // 1. Проверяем существование задачи и права доступа
      const task = await tx.task.findUnique({
        where: { id: taskId },
        include: {
          media: true, // Включаем медиафайлы для удаления
          participants: true, // Включаем участников
          bugs: true, // Включаем баги
        },
      });

      if (!task) {
        throw new Error('Задача не найдена');
      }

      // Проверяем права: только владелец может удалить задачу
      if (task.userId !== userId) {
        throw new Error('Нет прав для удаления задачи');
      }

      // 2. Получаем информацию о файлах перед удалением
      const filesToDelete = task.media.map((media) => ({
        id: media.id,
        filename: media.url, // имя файла в файловой системе
      }));

      // 3. Удаляем связанные данные в правильном порядке (из-за foreign keys)

      // Сначала удаляем баги (если есть зависимость от задачи)
      if (task.bugs.length > 0) {
        await tx.bug.deleteMany({
          where: { taskId },
        });
      }

      // Удаляем участников
      if (task.participants.length > 0) {
        await tx.taskParticipant.deleteMany({
          where: { taskId },
        });
      }

      // Удаляем медиафайлы из БД
      if (task.media.length > 0) {
        await tx.taskMedia.deleteMany({
          where: { taskId },
        });
      }

      // Удаляем скрытые задачи (если есть)
      await tx.hiddenTask.deleteMany({
        where: { taskId },
      });

      // 4. Удаляем саму задачу
      await tx.task.delete({
        where: { id: taskId },
      });

      return { task, filesToDelete };
    });

    // 5. Удаляем физические файлы после успешного удаления из БД
    if (result.filesToDelete.length > 0) {
      await deleteTaskFilesFromFS(result.filesToDelete);
    }

    res.json({
      message: 'Задача успешно удалена',
      deletedFilesCount: result.filesToDelete.length,
      deletedBugsCount: result.task.bugs.length,
      deletedParticipantsCount: result.task.participants.length,
    });
  } catch (error) {
    console.error('Ошибка при удалении задачи:', error);

    if (error.message === 'Задача не найдена') {
      return res.status(404).json({ message: 'Задача не найдена' });
    }

    if (error.message === 'Нет прав для удаления задачи') {
      return res.status(403).json({ message: 'Нет прав для удаления задачи' });
    }

    res.status(500).json({
      message: 'Ошибка при удалении задачи',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
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
