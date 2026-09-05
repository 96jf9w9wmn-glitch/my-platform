import { Component, Suspense } from "react"
import Icon from "./Icon"

// Ошибка загрузки куска приложения — не «сломался код», а «вкладка старше сайта».
//
// Тяжёлые разделы (Варианты, Банк заданий, доска, кабинет ученика) грузятся
// отдельными файлами по первому заходу, а раскатка идёт rsync --delete: файлы
// прошлой сборки с сервера СТИРАЮТСЯ. Вкладка, открытая до деплоя, продолжает
// работать на старом бандле и просит файл, которого больше нет. Без перехвата
// это исключение внутри рендера — React снимает всё дерево, и кабинет
// превращается в белый экран: «переключил вкладку, и сайт умер».
const CHUNK_RE = /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading/i

export default class PageBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error("Раздел не загрузился:", error)
  }

  render() {
    const { error } = this.state
    if (!error) {
      return (
        <Suspense fallback={this.props.fallback ?? (
          <div className="flex items-center justify-center py-20"><div className="loader-logo" /></div>
        )}>
          {this.props.children}
        </Suspense>
      )
    }

    const stale = CHUNK_RE.test(error?.message || "")
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
        <span className="w-11 h-11 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
          <Icon name={stale ? "repeat" : "warning"} size={18} />
        </span>
        <div className="text-sm text-gray-600 max-w-xs">
          {stale
            ? "Вышло обновление платформы — эта вкладка работает на прежней версии. Обновите страницу, чтобы открыть раздел."
            : "Раздел не открылся. Обновите страницу — если повторится, напишите нам."}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 rounded-full text-sm font-medium text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)" }}
        >
          Обновить страницу
        </button>
      </div>
    )
  }
}
