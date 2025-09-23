import fs from 'fs';
import path from 'path';

/**
 * Удаляет физические файлы задачи из файловой системы
 */
export const deleteTaskFilesFromFS = async (files: { id: string; filename: string }[]): Promise<void> => {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'tasks');

  if (!fs.existsSync(uploadsDir)) {
    console.log('Папка uploads/tasks не существует');
    return;
  }

  let deletedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      const filePath = path.join(uploadsDir, file.filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`Файл удален: ${file.filename}`);
      } else {
        console.warn(`Файл не найден: ${file.filename}`);
      }
    } catch (error) {
      errorCount++;
      console.error(`Ошибка удаления файла ${file.filename}:`, error);
    }
  }

  console.log(`Удалено файлов: ${deletedCount}, ошибок: ${errorCount}`);
};
