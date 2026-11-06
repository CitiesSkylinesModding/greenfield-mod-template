# What each locale does differently

The conventions a translator or a reviewer of a locale needs and would not guess from the English.

## Every locale

- **Term or practice.** A term is the game's name for an element the player must find in its UI: a menu, a tool, an info view, a setting, a building category. Where a string points the player at one, write the term as the game writes it in that language, odd or wrong: its words and capitals bind, while its quotes, apostrophes and spacing follow the typography below. Everything else is practice: typography, punctuation, grammar, register, capitalization, and every generic word, even one the game also uses. There, write what a professional translator would, never what the game does. Example: it-IT's game names the Mods menu "Modalità"; "mod" in prose is a generic word and stays "mod", while a sentence sending the player to that menu names it "Modalità".
- Each locale below lists its **game errors**, the game's practice not to copy, each with what to write instead, and its **game terms**, odd names used anyway.
- `{…}` is a variable: copy it byte for byte, `{KEY=…}` included, even where it reads as English.
- `<…>` renders as highlighted text: translate the text inside and keep the chevrons. In `<ID|label>` only the label after `|` is text; `<icon:…>`, `<image:…>` and `<inputAction:…>` are copied verbatim.
- Typography is the language's own: its typographic quotes, the apostrophe ’, the ellipsis …, the no-break space U+00A0. Write no straight ' or ", no three dots, and no dash (em dash, en dash, a spaced hyphen): a colon, a comma or parentheses carry the clause instead.
- **Banned**: U+202F and U+2009 → U+00A0. The game (measured on 1.6.2f1) breaks the line at either as at a plain space, orphaning a French : or ».
- The source's punctuation is deliberate: each mark carries over in the language's form. A colon stays a colon, a question a question, a final period a final period, and a label without one gets none.
- Capitalize as the language does: English Title Case becomes the language's sentence case, nouns aside where the language capitalizes them; a game term keeps the game's capitals.
- The file's existing form of address and its words for the mod's own concepts win over the game's; a column header or a button label stays as short as the English; a label a player ticks for themselves stays in the first person where the English is; where nouns decline, none follows a number placeholder: build the sentence so the number ends a clause ("…: {COUNT}").

## en-US (the source)

- Title Case for a label, a group, a section or a button; sentence case for a description.
- Game errors: ' " and ... → ’, “ ” and …; labels in sentence case ("Near max radius") → Title Case.

## de-DE

- „ “ quotes; a setting name in prose is bare, no quotes, capitalized as the game writes it.
- Game errors: du and Sie mixed → the file's du; "..." → …; a compound split by spaces ("Tilt-Shift Nahfeld Beginn") → joined or hyphenated; an English plural ("Dependencys") → the German word (Abhängigkeiten).

## es-ES

- The game's name for an option is treated as a singular noun of the option's gender when a sentence predicates it ("la opción … estaba desactivada").
- A change happens "en la versión" of the game, not "para".
- Game errors: straight "…" quotes → « », “ ” inside them; "..." → …; " - " as a separator → a colon.

## fr-FR

- « » with U+00A0, the ordinary no-break space, inside; U+00A0 before : ; ? !; a product name keeps its English punctuation ("Cities: Skylines II").
- A setting name in prose is bare and capitalized.
- Game errors: ' → ’; "..." → …; a plain space, or none, before : ; ? ! or inside « » → U+00A0; " - " as a separator → a colon.

## it-IT

- A bare adjective as a label ("Tue") reads oddly; give it its article ("Le tue").
- Game errors: straight "…" quotes → « »; ' → ’; "..." → …; " - " as a separator → a colon.
- Game terms: the Mods menu is "Modalità" (see Every locale); Elementi for assets, Oggetti for props.

## ja-JP

- Full-width punctuation: 「」 quotes, ：（）！？; a full-width colon after a Latin name.
- A relative date or a count needs its particle after the placeholder; a one-word heading that is vague alone takes a qualifier.
- Game errors: MOD and Mod mixed → MOD; half-width ( ) : , beside Japanese ("学習(ワークショップ)") → full-width; an ASCII space after a ？ or ！ the sentence goes on from → U+3000, the full-width space; a space between Japanese and Latin letters or digits ("ユニバーサル Mod パネル") → none ("MOD作者").

## ko-KR

- A particle after a placeholder whose last sound is unknown gives both forms: 이(가), 을(를), 은(는), (으)로; a relative date takes 에 after the placeholder.
- Game errors: straight " and ' quotes → “ ” and ‘ ’; "..." → ….
- Game term: 에셋 for assets, not 애셋.

## pl-PL

- „ ” quotes; a setting name in prose is capitalized when it names the control.
- Game errors: "..." → …; a spaced en dash in a description → a colon or a comma.
- Game term: Zasoby for assets.

## pt-BR

- No article before a setting name in prose.
- Game errors: straight "…" quotes → “ ”, ‘ ’ inside them; "..." → …; " - " as a separator ("Redução de ruído - segundo passe") → a colon.
- Game term: Elementos for assets.

## ru-RU

- « » quotes; no dashes even where Russian would put one: "это", a colon or a comma carries the clause.
- ё in the file's own prose (счётчик, её), where the game writes е; a game term keeps the game's spelling.
- Game errors: straight "…" quotes → « »; "..." → …; a spaced en dash or hyphen as тире ("Таксопарк – центр", "**Карта** - **Рабочая среда**") → rephrased.
- Game term: Объекты for both assets and props; a string that tells them apart gives props a distinct word (Пропсы).

## zh-HANS

- 模组 for mod; “ ” quotes, 《》 for titles, …… for the ellipsis, full-width ，：；！？（）.
- Spaces around Latin words and numbers.
- Game errors: a half-width ? or ( ) after Chinese ("NodeJS {NODEJS_VERSION}?其他") → full-width.

## zh-HANT

- Taiwan usage: 模組, 資產, 螢幕截圖.
- 「」 quotes, 『』 inside them; …… for the ellipsis; full-width ，：；！？（）; spaces around Latin words and numbers.
- A label before a placeholder that may start with a digit or a word takes a full-width colon ("時間：{WHEN}") so the spacing holds either way.
- A two-character noun that also reads as a verb takes a qualifier as a column header.
- Game errors: half-width ( ) around Chinese ("教廷 (梵蒂岡城國)") → （）.

## This mod's locale files

What each locale file settled for the mod's own strings: its form of address, the gender it gives "mod", its words for the mod's concepts. A line here wins over the sections above for its locale.

### de-DE

- Die Mod is feminine in this file, where the game also writes der Mod, so every label agreeing with it agrees feminine.

### fr-FR

- "carte" is the city's map.

### it-IT

- Mod is masculine in this file (il mod, del mod), where the game writes la mod.
