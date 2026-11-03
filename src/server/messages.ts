import type { Context } from 'hono';

export type Lang = 'ru' | 'en';

const messages = {
  ru: {
    needAuth: 'Нужна авторизация',
    forbidden: 'Недостаточно прав',
    credentialsRequired: 'Введите логин и пароль',
    badCredentials: 'Неверный логин или пароль',
    trackNotFound: 'Трек не найден',
    playlistNotFound: 'Плейлист не найден',
    titleEmpty: 'Название не может быть пустым',
    playlistTitleEmpty: 'Название плейлиста не может быть пустым',
    playlistLimit: 'Можно создать не больше {n} плейлистов',
    playlistOrderMismatch: 'Список треков не совпадает с плейлистом',
    tagEmpty: 'Имя тега пустое',
    noFiles: 'Нет файлов для загрузки',
    fileTooLarge: 'Файл слишком большой',
    unsupportedFormat: 'Неподдерживаемый формат',
    processFailed: 'Не удалось обработать файл',
    createFailed: 'Не удалось создать',
    saveFailed: 'Не удалось сохранить',
    addFailed: 'Не удалось добавить',
    orderFailed: 'Не удалось сохранить порядок',
    trackMissing: 'Не указан трек',
    badOrder: 'Некорректный порядок',
  },
  en: {
    needAuth: 'Sign in required',
    forbidden: 'Not enough permissions',
    credentialsRequired: 'Enter your username and password',
    badCredentials: 'Wrong username or password',
    trackNotFound: 'Track not found',
    playlistNotFound: 'Playlist not found',
    titleEmpty: 'The title cannot be empty',
    playlistTitleEmpty: 'The playlist name cannot be empty',
    playlistLimit: 'You can have at most {n} playlists',
    playlistOrderMismatch: 'The track list does not match the playlist',
    tagEmpty: 'The tag name is empty',
    noFiles: 'No files to upload',
    fileTooLarge: 'The file is too large',
    unsupportedFormat: 'Unsupported format',
    processFailed: 'Could not process the file',
    createFailed: 'Could not create',
    saveFailed: 'Could not save',
    addFailed: 'Could not add',
    orderFailed: 'Could not save the order',
    trackMissing: 'No track given',
    badOrder: 'Invalid order',
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type MessageKey = keyof (typeof messages)['ru'];
type Params = Record<string, string | number>;

function format(template: string, params?: Params): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => String(params?.[name] ?? whole));
}

export function tr(lang: Lang, key: MessageKey, params?: Params): string {
  return format(messages[lang][key], params);
}

/** An error whose text depends on the language of the request; it is turned into a message in the API layer. */
export class AppError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params?: Params,
  ) {
    super(format(messages.ru[key], params));
  }
}

/** The client sends `X-Lang`; without it the browser's `Accept-Language` decides. */
export function requestLang(c: Context): Lang {
  const explicit = c.req.header('X-Lang');
  if (explicit === 'ru' || explicit === 'en') {
    return explicit;
  }
  return (c.req.header('Accept-Language') ?? '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/** The text for an error caught in a route: ours is localised, anything else gets the fallback and goes to the log. */
export function errorText(c: Context, error: unknown, fallback: MessageKey): string {
  const lang = requestLang(c);
  if (error instanceof AppError) {
    return tr(lang, error.key, error.params);
  }
  console.error(error);
  return tr(lang, fallback);
}

export function fail(c: Context, status: 400 | 401 | 403 | 404, code: string, key: MessageKey) {
  return c.json({ error: code, message: tr(requestLang(c), key) }, status);
}
