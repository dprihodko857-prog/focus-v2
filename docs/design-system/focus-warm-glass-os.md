# Focus — Warm Glass OS

## Полная дизайн-система приложения-планировщика

---

# 1. Концепция

## Идея

«Фокус» — это не обычный таск-менеджер и не корпоративная CRM.

Приложение должно ощущаться как:

> тёплое интеллектуальное пространство для жизни, планирования, концентрации и личной организации.

Основные эмоциональные характеристики:

* спокойствие
* глубина
* дружелюбность
* cinematic atmosphere
* мягкая продуктивность
* premium minimalism
* уютная концентрация

---

# 2. Главные принципы интерфейса

## Не использовать

* pure white
* pure black
* кислотные цвета
* резкие контрасты
* тяжёлые рамки
* ощущение таблиц и CRM
* перегруженность линиями

## Использовать

* glassmorphism
* layered UI
* мягкие тени
* cinematic blur
* floating surfaces
* мягкие скругления
* воздух и spacing
* спокойные анимации

---

# 3. Архитектура интерфейса

```txt
AppShell
 ├─ Sidebar
 │   ├─ SidebarLogo
 │   ├─ SidebarToggle
 │   ├─ SidebarNavItem
 │   └─ SidebarFooter
 │
 ├─ TopBar
 │   ├─ CurrentDateCard
 │   ├─ DailyQuoteTicker
 │   └─ BookmarksButton
 │
 ├─ MainContent
 │   ├─ TodayOverview
 │   │   ├─ BirthdaysTodayCard
 │   │   └─ HistoricalEventsCard
 │   │
 │   ├─ SummaryCards
 │   ├─ LabelsLegend
 │   └─ FocusCalendar
 │
 ├─ RightPanel
 │   ├─ TodayTasks
 │   └─ QuickActions
 │
 └─ ModalLayer
     ├─ SettingsModal
     ├─ ScheduleWizardModal
     ├─ ReminderModal
     ├─ ConfirmDialog
     └─ VoiceInputPanel
```

---

# 4. Темы приложения

## Поддерживаемые темы

1. Контрастная
2. Тёплая
3. Тёмная

Все темы должны использовать:

* единые spacing tokens
* единые animation tokens
* единую компонентную систему
* единый motion language
* единую типографику

---

# 5. Тёплая тема (Primary Theme)

## Настроение

Уютное пространство концентрации.

## Цвета

### App Background

```css
#F5F1EA
```

### Secondary Background

```css
#EFE8DD
```

### Surface Glass

```css
rgba(255,255,255,.42)
```

### Elevated Surface

```css
rgba(255,255,255,.55)
```

### Primary Text

```css
#2F2A26
```

### Secondary Text

```css
#6F655E
```

### Muted Text

```css
#9C9187
```

### Primary Accent

```css
#5678F5
```

### Amber Accent

```css
#D89A3D
```

### Terracotta Accent

```css
#C56A4B
```

### Sage Accent

```css
#5F9073
```

### Lavender Accent

```css
#8C7AE6
```

### Rose Accent

```css
#C96A87
```

---

# 6. Контрастная тема

## Background

```css
#F7F7F5
```

## Surface

```css
rgba(255,255,255,.72)
```

## Primary Text

```css
#1E1E1E
```

## Accent

```css
#3366FF
```

Принцип:

* высокая читаемость
* мягкий contrast
* не использовать pure black / pure white

---

# 7. Тёмная тема

## Настроение

Cinematic premium dark UI.

## Background

```css
#131722
```

## Secondary Background

```css
#1A2030
```

## Surface

```css
rgba(255,255,255,.06)
```

## Border

```css
rgba(255,255,255,.08)
```

## Primary Text

```css
#F2F1EE
```

## Secondary Text

```css
#B7BCC9
```

## Accent

```css
#6F8CFF
```

## Glow

```css
0 0 24px rgba(111,140,255,.18)
```

---

# 8. Glass System

## Layer 1

```css
background:
rgba(255,255,255,.38);

backdrop-filter:
blur(18px);
```

## Layer 2

```css
background:
rgba(255,255,255,.55);

backdrop-filter:
blur(28px);
```

## Calendar Overlay

```css
background:
rgba(20,20,20,.16);
```

---

# 9. Shadow System

## Main Shadow

```css
box-shadow:
0 10px 40px rgba(0,0,0,.08);
```

## Elevated Shadow

```css
box-shadow:
0 30px 80px rgba(0,0,0,.14);
```

---

# 10. Sidebar System

## Expanded State

```css
width: 280px;
```

## Collapsed State

```css
width: 72px;
```

## Sidebar Background

```css
background:
rgba(255,255,255,.34);

backdrop-filter:
blur(22px);
```

## Active Navigation Item

```css
background:
rgba(86,120,245,.14);
```

* soft glow.

## Hover

```css
transform:
translateX(2px);
```

## Motion

```css
transition:
220ms cubic-bezier(.2,.8,.2,1);
```

## Sidebar Principles

* floating navigation dock
* лёгкость
* минимальный визуальный шум
* glow only on hover/active
* логотип не менять

---

# 11. TopBar

## Структура

```txt
[Сегодня] [Цитата дня] [Закладки]
```

Каждый блок:

* glass card
* floating surface
* мягкая тень
* мягкий blur

---

# 12. FocusCard System

Все карточки приложения должны использовать единый компонент:

```txt
FocusCard
```

## Используется для:

* События дня
* В этот день родились
* Сводка
* Метки
* Дела на сегодня
* Быстрые действия
* Задачи
* Напоминания

## Стиль

```css
border-radius: 24px;
```

```css
background:
rgba(255,255,255,.42);
```

```css
backdrop-filter:
blur(20px);
```

```css
border:
1px solid rgba(255,255,255,.22);
```

```css
padding:
24px;
```

---

# 13. TodayOverview

## Содержит

1. BirthdaysTodayCard
2. HistoricalEventsCard

## Стиль

* одинаковая высота
* единая система отступов
* мягкая иконография
* readable typography
* glass style

---

# 14. FocusCalendar

## Главная идея

Фон = эмоция.
Контент = читаемость.

## Сохранить

* сезонные изображения месяцев
* атмосферность
* cinematic feeling

## Улучшить

* overlay
* blur
* glass cells
* readability

## Calendar Cell

```css
background:
rgba(255,255,255,.10);
```

```css
backdrop-filter:
blur(10px);
```

```css
border:
1px solid rgba(255,255,255,.16);
```

```css
border-radius:
18px;
```

## Hover

```css
transform:
translateY(-2px);
```

* soft glow.

## Current Day

Использовать:

* ambient glow
* subtle highlight

Не использовать:

* грубые рамки
* агрессивный border

---

# 15. Seasonal Image System

## Весна

* dreamy
* soft bloom
* warm greens
* soft cinematic light

## Лето

* golden hour
* warm sunlight
* atmospheric glow

## Осень

* orange cinematic grading
* warm brown tones
* wet reflections

## Зима

* blue cinematic night
* cold atmosphere
* soft contrast

## Важно

Все изображения:

* одинаковая цветокоррекция
* одинаковая contrast curve
* одинаковая глубина
* единый cinematic style

---

# 16. Modal System

Все модальные окна:

* SettingsModal
* ScheduleWizardModal
* ReminderModal
* ConfirmDialog
* VoiceInputPanel

должны использовать:

```txt
FocusModal
```

## Структура

```txt
ModalHeader
ModalBody
ModalFooter
```

## Стиль

```css
background:
rgba(255,255,255,.52);
```

```css
backdrop-filter:
blur(28px);
```

```css
border:
1px solid rgba(255,255,255,.32);
```

```css
box-shadow:
0 30px 80px rgba(0,0,0,.18);
```

## Overlay

```css
background:
rgba(0,0,0,.28);
```

---

# 17. Button System

## Primary Button

```css
background:
linear-gradient(
135deg,
#4A72FF,
#5D83FF
);
```

## Secondary Button

Glass button.

## Danger Button

Использовать:

* terracotta
* soft red

Не использовать:

* aggressive red

## Hover

```css
transform:
translateY(-1px);
```

* glow.

---

# 18. Input System

## Стиль

```css
background:
rgba(255,255,255,.35);
```

```css
border:
1px solid rgba(255,255,255,.22);
```

## Focus Ring

```css
0 0 0 4px rgba(74,114,255,.12)
```

## Placeholder

Использовать muted text.

---

# 19. Typography

## Основной шрифт

* Inter
  или
* SF Pro Display style

## Заголовки

```css
font-weight: 650;
```

## Основной текст

```css
font-weight: 430-450;
```

## Размеры

### Headings

* 32px
* 24px
* 20px

### Body

```css
15-16px
```

## Не использовать

```css
#000000
```

## Использовать

```css
#2E2A27
```

---

# 20. Radius System

| Type   | Radius |
| ------ | ------ |
| Small  | 12px   |
| Medium | 18px   |
| Large  | 24px   |
| XL     | 32px   |

---

# 21. Motion System

## Fast

```css
140ms
```

## Standard

```css
220ms
```

## Smooth

```css
320ms
```

## Easing

```css
cubic-bezier(.2,.8,.2,1)
```

## Использовать

* subtle elevation
* glow hover
* smooth transitions
* floating motion

## Не использовать

* резкие анимации
* агрессивные эффекты
* gaming-style motion

---

# 22. Icon System

## Стиль

* outline icons
* rounded corners
* slightly thicker stroke
* soft glow on hover
* premium minimalism

## Важно

Иконки должны быть:

* дружелюбными
* мягкими
* современными
* consistent

## Добавить

### Иконка «Отменить»

Rounded undo arrow.

Стиль:

* outline
* мягкая
* glass hover
* subtle glow

---

# 23. Semantic Label System

| Категория     | Цвет         | HEX     |
| ------------- | ------------ | ------- |
| Напоминание   | Warm Blue    | #5678F5 |
| День рождения | Coral        | #D96B5F |
| Учёба         | Sage         | #5F9073 |
| Работа        | Amber        | #D89A3D |
| Важное        | Burnt Orange | #C56A4B |
| Семья         | Rose         | #C96A87 |
| Творчество    | Lavender     | #8C7AE6 |
| Спорт         | Cyan         | #47A7B8 |

## Метки отображать как

* dots
* chips
* legend items
* calendar markers

---

# 24. Settings Screen

## Темы отображать как

Theme Preview Cards:

```txt
[Контрастная]
[Тёплая]
[Тёмная]
```

Каждая карточка:

* preview UI
* mini palette
* glass style

---

# 25. Responsive System

## Desktop

* sidebar expanded/collapsed
* right panel visible

## Tablet

* collapsed sidebar by default
* stacked right panel

## Mobile

* bottom navigation
  или

* compact sidebar

* карточки в одну колонку

* readable calendar

---

# 26. Общий результат

В итоге приложение должно ощущаться:

* как самостоятельная OS
* современно
* тепло
* премиально
* атмосферно
* дружелюбно
* cinematic
* deeply personal

А не как:

* корпоративный SaaS
* CRM
* таблица задач
* офисное приложение

---

# 27. Ограничения

## Не менять

* логотип
* бизнес-логику
* API
* пользовательские данные
* существующие функции
* сезонную концепцию календаря

## Не ломать

* themes
* sidebar states
* modal logic
* calendar interactions
* schedule flows

---

# 28. Финальная визуальная цель

«Фокус» должен ощущаться как:

> тёплая интеллектуальная среда управления жизнью.

Не просто planner.

А:

* пространство концентрации
* пространство планирования
* пространство ритма жизни
* пространство спокойной продуктивности.

---

# 29. Focus v0.6 — Updated Design System Adaptation

## Главная корректировка концепции

После обновления ТЗ приложение «Фокус» окончательно смещается:

НЕ в сторону:

* task manager
* productivity CRM
* рабочего корпоративного planner

А в сторону:

# личной Фокус-панели дня.

Это означает:

* меньше ощущения «системы управления задачами»;
* больше ощущения личного пространства;
* спокойный рабочий ритм;
* быстрый доступ к важному сегодня;
* минимальный визуальный шум;
* мягкая информационная иерархия.

Warm Glass OS сохраняется как основа.

Но:

* уменьшается визуальная агрессия;
* уменьшается ощущение SaaS-панели;
* усиливается calm productivity;
* усиливается ощущение living dashboard.

---

# 30. Обновлённая визуальная философия

## Главный экран

Главный экран теперь:

# Focus Dashboard.

Главная задача интерфейса:

> ответить пользователю:
> «Что у меня сегодня важного и что рядом по времени?»

---

# 31. Новая визуальная иерархия

## Desktop

Визуальный приоритет:

1. Календарь месяца
2. Сводка на сегодня
3. Дела на сегодня
4. Метки
5. Интересное сегодня

---

# 32. Main Layout (Desktop)

```txt
Sidebar

Top Dock
 ├─ Current Date
 ├─ Quotes of the Day
 └─ Add Button

Main Grid
 ├─ Focus Calendar
 ├─ Today Summary
 └─ Today Tasks

Labels Row

Interesting Today (collapsible)
```

---

# 33. Main Layout (Mobile)

```txt
Date + Quotes
Add Button
Today Tasks
Today Summary
Labels
Calendar
Interesting Today
```

Mobile layout должен ощущаться:

* вертикальным;
* спокойным;
* не перегруженным;
* thumb-friendly.

---

# 34. Top Dock Redesign

TopBar превращается в:

# floating dock.

## Dock содержит:

* дату;
* день недели;
* Quotes of the Day;
* Add Button.

---

# 35. Quotes of the Day

Цитаты становятся:

# живой частью интерфейса.

## Правила:

* 5 новых цитат каждый день;
* показывается одна цитата;
* мягкая анимация смены;
* без marquee;
* без резких исчезновений;
* next / previous controls.

## Motion:

* fade;
* subtle slide;
* opacity transition.

## НЕ использовать:

* бегущие строки;
* ticker tape;
* резкий autoplay.

---

# 36. Add Button

Add Button становится:

# primary floating glass action.

## Стиль:

* заметная;
* но не агрессивная;
* glass surface;
* мягкий glow;
* rounded corners.

## Desktop:

Floating menu.

## Mobile:

Bottom sheet.

---

# 37. Sidebar Adaptation

Sidebar теперь:

# только навигация.

НЕ дублирует:

* календарь;
* today;
* tasks.

---

# Sidebar Items

* Фокус
* Создать напоминание
* Мои расписания
* Дни рождения
* Заметки
* Дневник
* Настройки

---

# Sidebar Behavior

## Desktop

Expanded by default.

## Tablet

Compact dock.

## Mobile

Bottom navigation.

---

# Exit Button

Кнопка Выйти:

* внизу sidebar;
* отдельный muted section;
* не конкурирует с основной навигацией.

---

# 38. Calendar Redesign Adaptation

Календарь остаётся:

# главным эмоциональным объектом приложения.

Но:
теперь он:

* меньше похож на decorative widget;
* больше связан с daily planning.

---

# Calendar Rules

* month-based;
* adaptive scaling;
* large desktop block;
* compact mobile layout;
* 12 seasonal backgrounds;
* month-aware background switching;
* glass date cells;
* semantic labels;
* fallback gradients.

---

# Weekend Highlight

НЕ использовать:

* яркий красный;
* heavy fill.

Использовать:

* terracotta outline;
* soft coral background;
* subtle warm accent.

---

# 39. Labels System Adaptation

Метки теперь:

# contextual.

Показываются:

* только активные.

Если нет активных:

* блок скрывается.

---

# Labels Layout

Компактная horizontal row над календарём.

---

# Labels Style

* glass chips;
* small colored dots;
* soft background;
* muted shadows.

---

# 40. Day Card System

При клике на дату:

# сначала открывается Day Card.

---

# Desktop

Right-side panel.

# Mobile

Bottom sheet.

---

# Day Card показывает

* дату;
* reminders;
* schedules;
* birthdays;
* holidays;
* add reminder action;
* open week action.

---

# Day Card НЕ показывает

* Today Tasks;
* Quotes;
* Interesting Today;
* historical cards.

---

# Reminder deletion

Удаление reminder возможно прямо внутри Day Card.

---

# 41. Weekly View

Weekly View:

# отдельная panel experience.

---

# Desktop

7 columns.

# Mobile

Vertical cards.

---

# Weekly View показывает

* reminders;
* schedules;
* birthdays.

НЕ показывает:

* diary;
* notes;
* today tasks.

---

# 42. Interesting Today

Interesting Today теперь:

# secondary expandable knowledge block.

Располагается:

* ниже main dashboard.

Содержит:

* В этот день родились;
* События дня.

---

# State Memory

Состояние collapse/expand сохраняется.

---

# 43. Today Summary Adaptation

Today Summary:

# только calendar-related events.

Показывает:

* reminders;
* schedules;
* birthdays;
* holidays;
* return to thought notes.

---

# НЕ показывает

* today tasks.

---

# Structure

1. Timed events
2. No-time events
3. Return to Thought block

---

# 44. Today Tasks Adaptation

Today Tasks:

# отдельный lightweight daily checklist.

---

# Важно

Today Tasks:

* НЕ попадают в календарь;
* НЕ попадают в summary;
* существуют только как daily operational layer.

---

# Task Card Style

* compact;
* soft checkbox;
* inline actions;
* minimal visual noise.

---

# 45. Reminder System Adaptation

Reminder теперь:

# lightweight calendar event.

Поля:

* text;
* date;
* optional time;
* optional note.

Дата обязательна.

---

# Reminder Visibility

Показывается:

* в календаре;
* в day card;
* в week view;
* в summary.

---

# 46. Schedules System Adaptation

Schedules становятся:

# одной из центральных сущностей приложения.

Поэтому:

* schedules UI должен быть production-grade;
* но спокойным;
* без CRM complexity feeling.

---

# Schedule Cards

## Compact

* title;
* role;
* type;
* color;
* days/time;
* status.

## Expanded

* next lesson;
* place;
* notes;
* mini week structure.

---

# Schedule Filters

Glass chips:

* Все
* Активные
* Пауза
* Участник
* Наставник

---

# Schedule Wizard

Schedule creation:

# multi-step calm wizard.

---

# Wizard Rules

* one step = one question;
* progress indicator;
* next/back;
* preview before save;
* smooth transitions.

---

# Wizard Style

НЕ делать:

* complex enterprise forms.

Делать:

* guided calm flow;
* large readable steps;
* breathing space.

---

# 47. Notes Adaptation

Notes:

# future thoughts space.

---

# Главная фраза

«Запиши будущее сначала в мыслях — потом в действиях.»

---

# Notes Style

* softer typography;
* warm paper feeling;
* calm reading layout.

---

# Return To Thought

НЕ reminder.

А:

# soft reflective block.

---

# 48. Diary Adaptation

Diary:

# отдельное приватное emotional пространство.

Должен ощущаться:

* интимным;
* спокойным;
* защищённым.

---

# Diary UI

* darker warm tones;
* softer contrast;
* reading-first layout.

---

# PIN Protection UX

PIN screen:

* minimal;
* calm;
* no aggressive security UI.

---

# Diary Calendar

Отдельный.

НЕ смешивать:

* с main calendar;
* с notes;
* с tasks.

---

# 49. Voice Input Adaptation

Voice input:

# helper feature.

НЕ центральная часть UI.

---

# Voice Button

Использовать:

* subtle dictation button;
* soft microphone icon;
* compact interaction.

---

# Voice UX

Voice используется:

* reminders;
* tasks;
* notes;
* diary;
* comments.

НЕ использовать:

* как основной способ заполнения complex schedule forms.

---

# 50. Settings Adaptation

Settings:

# calm configuration center.

---

# Sections

* theme;
* accent color;
* font size;
* diary password;
* account.

---

# НЕ добавлять

* technical settings;
* API settings;
* debug UI;
* local transcription toggles.

---

# 51. Mobile Philosophy

Mobile version:

# не desktop shrink.

А:

# отдельный calm vertical experience.

---

# Mobile Rules

* one-column layout;
* larger touch targets;
* readable spacing;
* compact glass cards;
* bottom sheets;
* bottom navigation.

---

# 52. Technical Frontend Adaptation

Новая дизайн-система должна внедряться:

# через новый frontend layer.

---

# CSS Structure

```txt
public/
  css/
    tokens.css
    themes.css
    layout.css
    components.css
    calendar.css
    modals.css
    schedules.css
    mobile.css
```

---

# JS Structure

```txt
public/
  js/
    api.js
    state.js
    calendar.js
    reminders.js
    tasks.js
    schedules.js
    notes.js
    diary.js
    settings.js
    voice.js
    render.js
```

---

# Frontend Philosophy

НЕ наслаивать:

* хаотичные CSS fixes;
* legacy overrides.

А:

# создать новый clean UI layer.

---

# 53. Production Design Principles

## Главное

Сохранить:

* emotional atmosphere;
* calm productivity;
* cinematic seasonal identity.

Но:

* убрать SaaS overload;
* убрать CRM feeling;
* усилить ощущение:
  «личной панели жизни».

---

# 54. Final UX Goal

Фокус должен ощущаться как:

> спокойная личная панель дня,
> которая помогает держать жизнь рядом,
> а не перегружает интерфейсом.
