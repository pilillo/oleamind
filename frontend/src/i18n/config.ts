import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import it from './locales/it.json'
import pt from './locales/pt.json'
import es from './locales/es.json'
import el from './locales/el.json'
import fr from './locales/fr.json'
import tr from './locales/tr.json'
import hr from './locales/hr.json'
import ar from './locales/ar.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      it: { translation: it },
      pt: { translation: pt },
      es: { translation: es },
      el: { translation: el },
      fr: { translation: fr },
      tr: { translation: tr },
      hr: { translation: hr },
      ar: { translation: ar }
    },
    lng: localStorage.getItem('language') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  })

export default i18n

