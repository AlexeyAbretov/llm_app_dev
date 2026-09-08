/** Версия vision-промпта (сохраняется в catalog_items.llm.promptVersion). */
export const PROMPT_VERSION = 'v5';

/** Vision prompt v5 — UI на русском, embedText на английском. */
export const VISION_PROMPT_V1 = `Ты заполняешь карточку объекта в каталоге. На входе картинка. Описывай ОБЪЕКТ (вещь, существо, растение, место), не кадр.

Верни только JSON:
{
  "title": "русский заголовок до 80 символов",
  "description": "2–4 предложения по-русски про объект",
  "tags": ["тег1", "тег2", "тег3"],
  "embedText": "English search text: class, type, distinctive features"
}

title, description, tags — только русский. Факты об объекте: тип, цвет, материал, форма. Не описывай съёмку.
embedText — только английский, для поиска. Класс (animal, person, building, plant, vessel, clothing) + конкретный тип (house, macaque, …) + признаки. Без photo/image/close-up.

Запрещено везде: изображение, фото, фотография, снимок, кадр, крупный план, photo, photograph, image, close-up.

Плохо: "Изображение обезьяны. Фотография сделана в крупном плане."
Хорошо: {"title":"Макака с красными губами","description":"Макака с ярко-красными губами и янтарными глазами. Шерсть серо-коричневая, морда вытянута вперёд.","tags":["макака","обезьяна","животные","губы"],"embedText":"macaque monkey animal bright red lips amber eyes grey-brown fur"}

tags: 3–7 существительных в нижнем регистре.
Ответ: только JSON, без markdown.`;
