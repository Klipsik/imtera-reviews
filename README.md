# Imtera Reviews

стек: laravel 13, reverb, vue 3, pinia, vuetify, sanctum, postgresql, redis, playwright

## запуск в docker

```bash
cp .env.docker.example .env
bash scripts/docker-up.sh
```

логин: `admin@imtera.local` / `password` 

данные postgres в `postgres_data`

## локально без docker

```bash
cp .env.example .env
composer install
php artisan key:generate
bash .docs/scripts/setup-native.sh
bun install && bun run build
cd services/parser && bun install && bunx playwright install chromium
cd ../..
composer dev
```

## парсинг

у яндекс карт нет публичного api для отзывов, поэтому отдельный микросервис services/parser на playwright

один headless chromium на процесс, одна browser-сессия на импорт организации

источники данных:

- первая страница отзывов в html ответа (ssr, до 50 штук)
- дальше внутренний api fetchReviews по 50 штук на страницу, подгружается при скролле

почему не 600 сразу: яндекс отдает порциями, так устроена их выдача. мы повторяем поведение браузера (скролл + перехват xhr), на бэк отдаем поток ndjson пачками по ~50 отзывов

кэш:

- redis для очереди и broadcast
- сами отзывы в redis не кэшируем, только в бд
- повторный импорт (кнопка обновить) перезапускает job с новым id старая задача прекращается

сохранение:

- laravel job читает поток из parser
- ReviewImportService делает upsert в postgresql по паре organization_id + yandex_review_id
- дубликаты внутри пачки отбрасываются
- прогресс уходит на фронт через reverb(для реалтайм визуала)

миграции: users, organizations, reviews, cities, organization_types, очередь, sanctum

## если бы было больше времени

- серверная пагинация и фильтры отзывов
- мультиимпорт, со статусами на странице организаций
- явная кнопка отмены импорта с обрывом http к parser
- очередь на стороне parser
- тестовые данные html в тестах parser без хождения в сеть
- выгрузка отзывов в csv
- ответы организации из raw_data в интерфейсе

