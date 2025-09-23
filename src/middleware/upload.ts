import multer from 'multer';
import path from 'path';
import fs from 'fs';

const tasksUploadDir = path.join(process.cwd(), 'uploads', 'tasks');
if (!fs.existsSync(tasksUploadDir)) {
  fs.mkdirSync(tasksUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tasksUploadDir);
  },
  filename: (req, file, cb) => {
    // Используем временное имя, потом переименуем
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `temp_${timestamp}_${safeName}`;
    cb(null, filename);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});
