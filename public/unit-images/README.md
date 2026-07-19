Drop unit reference images here.

Suggested filenames:

- clone-trooper.png
- jedi-task-force.png
- laat-patrol.png
- b1-droid.png
- droideka.png
- b2-super-battle-droid.png
- aat-battle-tank.png

The app reads these paths from `src/data.ts`.

Current edited variants:

- clone-trooper-scifi.png
- jedi-task-force-scifi.png
- b1-droid-scifi.png
- b2-super-battle-droid-scifi.png

The `*-scifi.png` files preserve the original unit photo and replace the plain white background with a neutral sci-fi hangar backdrop.

## Cropped source photos

The `photos/` directory contains square crops made from the original photographs in
`C:\Users\raorendo\Desktop\Lego Star Wars Battles`. The crops only normalize the
camera orientation and framing; they do not remove or replace the photographed background.

Source mapping:

- `IMG_0978.jpeg` -> `photos/clone-command-squad.jpg`
- `IMG_0979.jpeg` -> `photos/asajj-ventress.jpg`
- `IMG_0980.jpeg` -> `photos/jango-fett.jpg`
- `IMG_0981.jpeg` -> `photos/b2-super-battle-droid.jpg`
- `IMG_0982.jpeg` -> `photos/b1-battle-droid.jpg`
- `IMG_0983.jpeg` -> `photos/clone-trooper.jpg`
- `IMG_0984.jpeg` -> `photos/arc-trooper.jpg`
- `IMG_0985.jpeg` -> `photos/anakin-skywalker.jpg`
- `IMG_0986.jpeg` -> `photos/bx-commando-droid.jpg`
- `IMG_0987.jpeg` -> `photos/obi-wan-kenobi.jpg`
- `IMG_0988.jpeg` -> `photos/clone-assault-squad.jpg`
- `IMG_0989.jpeg` -> `photos/commander-cody.jpg`
- `IMG_0990.jpeg` -> `photos/darth-maul.jpg`
- `IMG_0991.jpeg` -> `photos/ahsoka-tano.jpg`
- `IMG_0992.jpeg` -> `photos/clone-engineers.jpg`
- `IMG_0993.jpeg` -> `photos/captain-rex.jpg`
- `IMG_0994.jpeg` -> `photos/yoda.jpg`
- `IMG_0995.jpeg` -> `photos/stap-patrol.jpg`
- `IMG_0996.jpeg` -> `photos/at-rt-scout-walker.jpg`
- `IMG_0997.jpeg` -> `photos/droideka.jpg`

## Token crops

The `tokens/` directory contains 512x512 close crops derived from the corresponding
files in `photos/`. Infantry tokens focus on the complete head, helmet, or headpiece,
while vehicle tokens retain the recognizable vehicle silhouette. The map applies
faction-colored circular borders and falls back to the generated CSS token when a
photo crop is unavailable.
