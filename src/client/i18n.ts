import { ref } from 'vue';
import { localeEn, localeRu, setTaoLocale } from '@1337exp/taoui';

export type Lang = 'ru' | 'en';

type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
type Message = string | Plural;

const STORAGE_KEY = 'mh-lang';

const ru = {
  'app.name': 'Облако Музыки',
  'app.brand': 'Музыка',
  'lang.label': 'Язык',

  'nav.library': 'Коллекция',
  'nav.playlists': 'Плейлисты',
  'nav.history': 'История',
  'nav.upload': 'Загрузка',
  'nav.more': 'Ещё',
  'nav.sections': 'Разделы',
  'nav.logout': 'Выйти',

  'role.admin': 'Админ',
  'role.editor': 'Редактор',
  'role.listener': 'Слушатель',

  'common.unknownArtist': 'Неизвестный исполнитель',
  'common.requestFailed': 'Ошибка запроса',

  'player.idleTitle': 'Ничего не играет',
  'player.idleHint': 'Выберите трек из коллекции',
  'player.play': 'Играть',
  'player.pause': 'Пауза',
  'player.prev': 'Предыдущий',
  'player.next': 'Следующий',
  'player.collapse': 'Свернуть',
  'player.repeatAll': 'Повтор всего',
  'player.repeatOne': 'Повтор трека',
  'player.repeatOff': 'Повтор выключен',
  'player.shuffleOn': 'Перемешивание включено',
  'player.shuffleOff': 'Перемешать',
  'player.mute': 'Выключить звук',
  'player.unmute': 'Включить звук',

  'library.title': 'Коллекция',
  'library.count': { one: '{n} трек', few: '{n} трека', many: '{n} треков', other: '{n} трека' },
  'library.search': 'Поиск по названию, исполнителю, тегу',
  'library.sortNewest': 'Сначала новые',
  'library.sortTitle': 'Название',
  'library.sortArtist': 'Исполнитель',
  'library.sortAlbum': 'Альбом',
  'library.sortDuration': 'Длительность',
  'library.emptyTitle': 'Ничего не нашлось',
  'library.emptyFiltered': 'Попробуйте другой запрос или снимите тег.',
  'library.emptyEditor': 'Загрузите файлы в разделе «Загрузка» или прогоните индексацию.',
  'library.emptyListener': 'Попросите редактора добавить музыку.',
  'library.loadFailed': 'Не удалось загрузить треки',
  'library.deleteTitle': 'Удалить трек?',
  'library.deleted': 'Трек удалён',

  'table.track': 'Трек',
  'table.album': 'Альбом',
  'table.tags': 'Теги',
  'table.time': 'Время',
  'table.toPlaylist': 'В плейлист',
  'table.edit': 'Изменить',
  'table.delete': 'Удалить из библиотеки',
  'table.removeFromPlaylist': 'Убрать из плейлиста',
  'table.drag': 'Перетащить',
  'table.playTrack': 'Играть {title}',
  'table.emptyTitle': 'Пока тихо',
  'table.emptyText': 'Здесь появятся треки, когда библиотека наполнится.',

  'playlists.title': 'Плейлисты',
  'playlists.newPlaceholder': 'Новый плейлист',
  'playlists.create': 'Создать',
  'playlists.emptyTitle': 'Плейлистов пока нет',
  'playlists.emptyText': 'Соберите подборку — до {max} штук на аккаунт.',
  'playlists.trackCount': 'Треков: {n}',
  'playlists.delete': 'Удалить',
  'playlists.created': 'Плейлист создан',
  'playlists.removed': 'Удалено',
  'playlists.createFailed': 'Не удалось создать',
  'playlists.deleteTitle': 'Удалить плейлист?',

  'playlist.deleteAction': 'Удалить плейлист',
  'playlist.renamed': 'Название сохранено',
  'playlist.saveFailed': 'Не удалось сохранить',
  'playlist.orderFailed': 'Не удалось сохранить порядок',
  'playlist.deleteTrackTitle': 'Удалить трек из библиотеки?',
  'playlist.emptyTitle': 'Плейлист пуст',
  'playlist.emptyText': 'Добавьте треки из коллекции через меню «⋯».',

  'history.title': 'История',
  'history.hint': 'Последние {limit} прослушиваний. Повтор того же трека подряд не записывается.',
  'history.emptyTitle': 'История пуста',
  'history.emptyText': 'Начните прослушивание — сюда попадут последние треки.',

  'upload.title': 'Загрузка',
  'upload.button': 'Загрузить',
  'upload.added': 'Добавлены',
  'upload.duplicates': 'Уже в библиотеке — используем существующий файл',
  'upload.failedTitle': 'Не загрузились',
  'upload.addedAndReused': 'Добавлено: {added}. Ещё {reused} уже были — используем их',
  'upload.reusedOne': 'Файл уже в библиотеке — используем существующий трек',
  'upload.reusedMany': 'Файлы уже в библиотеке — используем существующие ({n})',
  'upload.addedOne': 'Добавлено в библиотеку',
  'upload.addedMany': 'Добавлено в библиотеку: {n}',
  'upload.partial': '{message}. Не удалось: {failed}',
  'upload.errors': 'Ошибки: {n}',
  'upload.failed': 'Не удалось загрузить',

  'login.title': 'Облако Музыки',
  'login.subtitle': 'Там, где музыка. Войдите, чтобы слушать.',
  'login.username': 'Логин',
  'login.password': 'Пароль',
  'login.submit': 'Войти',
  'login.failed': 'Не удалось войти',

  'addToPlaylist.title': 'Добавить в плейлист',
  'addToPlaylist.playlist': 'Плейлист',
  'addToPlaylist.orNew': 'Или новый',
  'addToPlaylist.name': 'Название',
  'addToPlaylist.placeholder': 'Вечерний микс',
  'addToPlaylist.submit': 'Добавить',
  'addToPlaylist.needPlaylist': 'Создайте плейлист или выберите существующий',
  'addToPlaylist.done': 'Добавлено в плейлист',
  'addToPlaylist.failed': 'Не удалось добавить',

  'edit.title': 'Редактирование трека',
  'edit.name': 'Название',
  'edit.artist': 'Исполнитель',
  'edit.album': 'Альбом',
  'edit.year': 'Год',
  'edit.optional': 'Необязательно',
  'edit.tags': 'Теги',
  'edit.tagsHint': 'Жанр и любые пометки. Enter — добавить',
  'edit.tagPlaceholder': 'Например: jazz',
  'edit.save': 'Сохранить',
  'edit.saved': 'Трек обновлён',
  'edit.failed': 'Не удалось сохранить',
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof ru;

const en: Record<MessageKey, Message> = {
  'app.name': 'Cloud Music',
  'app.brand': 'Music',
  'lang.label': 'Language',

  'nav.library': 'Library',
  'nav.playlists': 'Playlists',
  'nav.history': 'History',
  'nav.upload': 'Upload',
  'nav.more': 'More',
  'nav.sections': 'Sections',
  'nav.logout': 'Sign out',

  'role.admin': 'Admin',
  'role.editor': 'Editor',
  'role.listener': 'Listener',

  'common.unknownArtist': 'Unknown artist',
  'common.requestFailed': 'Request failed',

  'player.idleTitle': 'Nothing is playing',
  'player.idleHint': 'Pick a track from the library',
  'player.play': 'Play',
  'player.pause': 'Pause',
  'player.prev': 'Previous',
  'player.next': 'Next',
  'player.collapse': 'Collapse',
  'player.repeatAll': 'Repeat all',
  'player.repeatOne': 'Repeat one',
  'player.repeatOff': 'Repeat off',
  'player.shuffleOn': 'Shuffle on',
  'player.shuffleOff': 'Shuffle',
  'player.mute': 'Mute',
  'player.unmute': 'Unmute',

  'library.title': 'Library',
  'library.count': { one: '{n} track', other: '{n} tracks' },
  'library.search': 'Search by title, artist or tag',
  'library.sortNewest': 'Newest first',
  'library.sortTitle': 'Title',
  'library.sortArtist': 'Artist',
  'library.sortAlbum': 'Album',
  'library.sortDuration': 'Duration',
  'library.emptyTitle': 'Nothing found',
  'library.emptyFiltered': 'Try another query or clear the tag.',
  'library.emptyEditor': 'Upload files in the Upload section or run the indexer.',
  'library.emptyListener': 'Ask an editor to add some music.',
  'library.loadFailed': 'Could not load the tracks',
  'library.deleteTitle': 'Delete the track?',
  'library.deleted': 'Track deleted',

  'table.track': 'Track',
  'table.album': 'Album',
  'table.tags': 'Tags',
  'table.time': 'Time',
  'table.toPlaylist': 'Add to playlist',
  'table.edit': 'Edit',
  'table.delete': 'Delete from library',
  'table.removeFromPlaylist': 'Remove from playlist',
  'table.drag': 'Drag',
  'table.playTrack': 'Play {title}',
  'table.emptyTitle': 'All quiet',
  'table.emptyText': 'Tracks will show up here once the library has some music.',

  'playlists.title': 'Playlists',
  'playlists.newPlaceholder': 'New playlist',
  'playlists.create': 'Create',
  'playlists.emptyTitle': 'No playlists yet',
  'playlists.emptyText': 'Put a mix together — up to {max} per account.',
  'playlists.trackCount': 'Tracks: {n}',
  'playlists.delete': 'Delete',
  'playlists.created': 'Playlist created',
  'playlists.removed': 'Deleted',
  'playlists.createFailed': 'Could not create',
  'playlists.deleteTitle': 'Delete the playlist?',

  'playlist.deleteAction': 'Delete playlist',
  'playlist.renamed': 'Name saved',
  'playlist.saveFailed': 'Could not save',
  'playlist.orderFailed': 'Could not save the order',
  'playlist.deleteTrackTitle': 'Delete the track from the library?',
  'playlist.emptyTitle': 'The playlist is empty',
  'playlist.emptyText': 'Add tracks from the library with the “⋯” menu.',

  'history.title': 'History',
  'history.hint': 'The last {limit} plays. Playing the same track twice in a row is not recorded.',
  'history.emptyTitle': 'History is empty',
  'history.emptyText': 'Start listening — the latest tracks will show up here.',

  'upload.title': 'Upload',
  'upload.button': 'Upload',
  'upload.added': 'Added',
  'upload.duplicates': 'Already in the library — using the existing file',
  'upload.failedTitle': 'Failed to upload',
  'upload.addedAndReused': 'Added: {added}. {reused} more were already there — using them',
  'upload.reusedOne': 'The file is already in the library — using the existing track',
  'upload.reusedMany': 'The files are already in the library — using the existing ones ({n})',
  'upload.addedOne': 'Added to the library',
  'upload.addedMany': 'Added to the library: {n}',
  'upload.partial': '{message}. Failed: {failed}',
  'upload.errors': 'Errors: {n}',
  'upload.failed': 'Could not upload',

  'login.title': 'Cloud Music',
  'login.subtitle': 'Where the music is. Sign in to listen.',
  'login.username': 'Username',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.failed': 'Could not sign in',

  'addToPlaylist.title': 'Add to playlist',
  'addToPlaylist.playlist': 'Playlist',
  'addToPlaylist.orNew': 'Or a new one',
  'addToPlaylist.name': 'Name',
  'addToPlaylist.placeholder': 'Evening mix',
  'addToPlaylist.submit': 'Add',
  'addToPlaylist.needPlaylist': 'Create a playlist or pick an existing one',
  'addToPlaylist.done': 'Added to the playlist',
  'addToPlaylist.failed': 'Could not add',

  'edit.title': 'Edit track',
  'edit.name': 'Title',
  'edit.artist': 'Artist',
  'edit.album': 'Album',
  'edit.year': 'Year',
  'edit.optional': 'Optional',
  'edit.tags': 'Tags',
  'edit.tagsHint': 'Genre and any labels. Enter adds one',
  'edit.tagPlaceholder': 'For example: jazz',
  'edit.save': 'Save',
  'edit.saved': 'Track updated',
  'edit.failed': 'Could not save',
};

const dictionaries: Record<Lang, Record<MessageKey, Message>> = { ru, en };
const pluralRules: Record<Lang, Intl.PluralRules> = {
  ru: new Intl.PluralRules('ru'),
  en: new Intl.PluralRules('en'),
};

function readStored(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'ru' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}

function detect(): Lang {
  return readStored() ?? (navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en');
}

export const lang = ref<Lang>(detect());

export function applyLang(value: Lang): void {
  document.documentElement.lang = value;
  setTaoLocale(value === 'ru' ? localeRu : localeEn);
  // the player takes the title over while a track is loaded; this covers the login page
  document.title = t('app.name');
}

export function setLang(value: Lang): void {
  lang.value = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // a private window: the choice just does not survive a reload
  }
  applyLang(value);
}

/** Reads `lang`, so a template or a computed that calls it re-renders when the language is switched. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const entry = dictionaries[lang.value][key];
  const template =
    typeof entry === 'string' ? entry : (entry[pluralRules[lang.value].select(Number(params?.n))] ?? entry.other);
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => String(params?.[name] ?? whole));
}
