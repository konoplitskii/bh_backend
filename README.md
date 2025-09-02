start project for nlk

# Пропустите миграции и напрямую обновите схему

npx prisma db push

Примените миграции заново
npx prisma migrate dev

````js
"scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts", // 🚀 Запуск проекта в режиме разработки с автоперезапуском при изменениях
    "build": "tsc", // 🏗️ Сборка проекта TypeScript в папку dist/
    "start": "node dist/index.js", // ▶️ Запуск собранного JS-кода из папки dist/
    "prisma:migrate": "npx prisma migrate dev",   // 🔧 Применить миграции и обновить базу данных в dev-режиме  Используется при добавлении или изменении моделей в schema.prisma
    "prisma:generate": "npx prisma generate", // ⚙️ Сгенерировать Prisma Client (всегда после изменения schema.prisma)
    "prisma:studio": "npx prisma studio", // 🧭 Открыть Prisma Studio — веб-интерфейс для просмотра и редактирования данных
    "prisma:reset": "npx prisma migrate reset --force --skip-seed",  // ♻️ Полный сброс базы данных (удаление всех данных, пересоздание схемы) Используй на ранних этапах разработки или при ошибках миграции
    "prisma:deploy": "npx prisma migrate deploy", // 🚚 Применить все готовые миграции в проде (используется на сервере)
    "lint": "npx eslint . --ext .ts"   // 🧹 Проверка и исправление кода по правилам ESLint (если ESLint настроен)
  },```
````
