# Lorever Voice Studio

Record your own voice for the narrator of [Lorever](https://www.curseforge.com/wow/addons/lorever), the lore add-on for World of Warcraft: Forever.

You read the lore texts aloud, one by one. The studio turns your recordings into a voice pack. Put the pack in your AddOns folder, and the Lorever narrator speaks with your voice.

> Needs **Lorever 1.8.0 or newer** in the game.

## Install

1. Open the [latest release](https://github.com/acappa221b/Lorever-Voice/releases/latest).
2. Download `LoreverVoiceStudio-<version>.exe`.
3. Run it. There is nothing to install.

The app is not signed. Windows can show "Windows protected your PC". Click **More info**, then **Run anyway**.

## Record

1. Write your name at the top. It goes on your pack.
2. Choose your microphone at the top. The green bar moves when it hears you.
3. Pick a zone on the left.
4. Press **Record** (or the space bar) and read the text at your own pace.
5. Press **Stop** (or the space bar again). The next text is ready.

- **Play** lets you hear a take. **Delete** removes it. You can record a text again at any time.
- A check mark shows each text you recorded. The numbers on the left show how far you are in each zone.
- Silence at the start and the end of a take is cut for you.
- Your takes stay on your computer. Nothing is sent anywhere.

Tips: a quiet room, the microphone a hand away from your mouth, and a glass of water.

## Use your pack in the game

1. Press **Export (.zip)** and save the zip.
2. Unzip it into `World of Warcraft\Interface\AddOns`. You get a folder named `LoreverNarration_enUS_<YourName>`.
3. Start the game. In Lorever, open the narrator settings and choose your pack.

You do not need to record everything. The narrator uses your voice where you recorded, and the game's voice (or another pack) for the rest.

## What is inside

- Only the texts written for Lorever. There is no text from the game and no text from Blizzard.
- English only, for now. The lands of levels 1 to 20: the starting zones, the cities and the first dungeons.

## For developers

```bash
npm install
npm start
npm test
npm run dist
```

The texts in `app/data/enUS.json` come from the Lorever repository (`tools/studio_export.py`).

## License

GPL-3.0. The MP3 encoder is lamejs ([@breezystack/lamejs](https://www.npmjs.com/package/@breezystack/lamejs)) (LGPL-3.0).

World of Warcraft and Blizzard Entertainment are trademarks of Blizzard Entertainment, Inc. This project is not made by or endorsed by Blizzard.
