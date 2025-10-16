import { Request, Response } from 'express';
import prisma from '../prisma';
import fs from 'fs';
import path from 'path';

export const fileController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const taskId = req.params.id;
    const { fileName } = req.body; // ожидаем fileName — например: '/uploads/tasks/uuid_12345_abc.png'

    if (!userId) return res.status(401).json({ message: 'Не авторизован' });
    if (!taskId) return res.status(400).json({ message: 'Не указан ID задачи' });
    if (!fileName) return res.status(400).json({ message: 'Не указан файл для удаления' });

    // Извлекаем имя файла (всё после "tasks/")
    const afterTasks = fileName.split('tasks/')[1];
    if (!afterTasks) {
      return res.status(400).json({ message: 'Некорректный путь к файлу' });
    }

    // Проверяем, принадлежит ли задача пользователю
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId, // владелец
      },
    });

    if (!task) {
      return res.status(403).json({ message: 'Нет доступа к задаче' });
    }

    // Проверяем, есть ли файл в media
    const media = await prisma.taskMedia.findFirst({
      where: {
        taskId,
        url: afterTasks, // мы сохраняем именно имя файла в БД
      },
    });

    if (!media) {
      return res.status(404).json({ message: 'Файл не найден в БД' });
    }

    // Удаляем запись из БД
    await prisma.taskMedia.delete({
      where: { id: media.id },
    });

    // Удаляем файл с диска
    const filePath = path.join(process.cwd(), 'uploads', 'tasks', afterTasks);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.json({
      result: true,
      message: 'Файл успешно удалён',
      deleted: afterTasks,
    });
  } catch (error) {
    console.error('Ошибка при удалении файла:', error);
    return res.status(500).json({
      message: 'Ошибка при удалении файла',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
};
