/*
 * Language registry and loader. The words themselves live in one file per
 * language: js/lang/uz.js, js/lang/ru.js, js/lang/en.js. Only the language in
 * use is downloaded.
 *
 * To add a language:
 *   1. add it to `languages` below,
 *   2. copy js/lang/en.js to js/lang/<code>.js and translate the values,
 *   3. add "<code>" texts to data/facts.json, then run: node tools/build.js
 * Missing keys fall back to English, then to the key itself
 * (node tools/build.js --check lists any missing keys).
 *
 * Uzbek uses the official apostrophe letters: ʻ (U+02BB) in oʻ/gʻ and
 * ʼ (U+02BC) for the tutuq belgisi. Search treats ' ʻ ʼ ‘ ’ as one character.
 */
window.MEDULLA_I18N = {
  defaultLang: "uz",

  languages: [
    { code: "uz", label: "UZ", name: "Oʻzbekcha", locale: "uz_UZ", bcp47: "uz-UZ", decimal: ",", group: " " },
    { code: "ru", label: "RU", name: "Русский", locale: "ru_RU", bcp47: "ru-RU", decimal: ",", group: " " },
    { code: "en", label: "EN", name: "English", locale: "en_US", bcp47: "en-GB", decimal: ".", group: "," }
  ],

  strings: {},

  // Loads js/lang/<code>.js once. Resolves when MEDULLA_I18N.strings[code] exists.
  load: function (code) {
    var self = this;
    if (self.strings[code]) return Promise.resolve(code);
    if (!self._pending) self._pending = {};
    if (self._pending[code]) return self._pending[code];
    var root = (document.body && document.body.getAttribute("data-root")) || "";
    self._pending[code] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = root + "js/lang/" + code + ".js";
      s.onload = function () { self.strings[code] ? resolve(code) : reject(new Error("empty language file")); };
      s.onerror = function () { delete self._pending[code]; reject(new Error("cannot load " + code)); };
      document.head.appendChild(s);
    });
    return self._pending[code];
  }
};
