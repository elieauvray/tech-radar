# Motivation

At [Zalando](http://zalando.de), we maintain a [public Tech
Radar](http://zalando.github.io/tech-radar/) to help our engineering teams
align on technology choices. It is based on the [pioneering work
by ThoughtWorks](https://www.thoughtworks.com/radar).

This repository contains the code to generate the visualization:
[`radar.js`](/docs/radar.js) (based on [d3.js v7](https://d3js.org)).
Feel free to use and adapt it for your own purposes.

> [!NOTE]
> Since v0.12, we're using d3.js v7. See [related PR](https://github.com/zalando/tech-radar/pull/197/files)
> if you need to apply changes in your fork.

## Usage

1. include `d3.js` and `radar.js`:

```html
<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="https://zalando.github.io/tech-radar/release/radar-0.12.js"></script>
```

2. insert an empty `svg` tag:

```html
<svg id="radar"></svg>
```

3. configure the radar visualization:

```js
radar_visualization({
  repo_url: "https://github.com/zalando/tech-radar",
  svg_id: "radar",
  width: 1450,
  height: 1000,
  scale: 1.0,
  colors: {
    background: "#fff",
    grid: "#bbb",
    inactive: "#ddd"
  },
  // Some font families might lead to font size issues
  // Arial, Helvetica, or Source Sans Pro seem to work well though
  font_family: "Arial, Helvetica",
  title: "My Radar",
  // Optional: show a logo image instead of the text title. `title` is then
  // used as the image's accessible label. `title_suffix` is drawn after the logo.
  // title_logo: { url: "images/my-logo.svg", width: 198, height: 39 },
  // title_suffix: "Tech Radar",
  // Optional: vertical space between the title header and the radar (default 40).
  // header_gap: 40,
  // Optional: gradient band behind the title. `width` defaults to reaching the
  // right edge of the radar; set `title_banner: null` to disable the band.
  // title_banner: { height: 51, from: "#000000", to: "#e9041e", text_color: "#fff" },
  quadrants: [
    { name: "Bottom Right" },
    { name: "Bottom Left" },
    { name: "Top Left" },
    { name: "Top Right" }
  ],
  rings: [
    { name: "INNER",  color: "#5ba300" },
    { name: "SECOND", color: "#009eb0" },
    { name: "THIRD",  color: "#c7ba00" },
    { name: "OUTER",  color: "#e09b96" }
  ],
  print_layout: true,
  links_in_new_tabs: true,
  entries: [
   {
      label: "Some Entry",
      quadrant: 3,          // 0,1,2,3 (counting clockwise, starting from bottom right)
      ring: 2,              // 0,1,2,3 (starting from inside)
      moved: -1             // -1 = moved out (triangle pointing down)
                            //  0 = not moved (circle)
                            //  1 = moved in  (triangle pointing up)
                            //  2 = new       (star)
   },
    // ...
  ]
});
```

Entries are positioned automatically so that they don't overlap. The "scale" parameter can help
in adjusting the size of the radar.

As a working example, you can check out `docs/index.html` &mdash; the source of our [public Tech
Radar](http://zalando.github.io/tech-radar/).

## Architecture

The radar entries are stored in a PostgreSQL `technologies` table
(`number`, `title`, `description`, `type`, `status`, `trend`). A small
Express server (`server/`) serves the front end in `docs/` and exposes
`GET /api/technologies`, which returns every technology ordered by `number`.
`docs/index.html` builds the radar from that endpoint; the mapping from
`type` / `status` / `trend` to quadrant / ring / moved lives in
`docs/technology-mapping.js`. `docs/config.json` only holds the radar `date`.

- `db/migrations/` holds the SQL schema; `node db/migrate.js` runs it and is safe to run more than once.
- `node db/seed.js` loads `db/seed-data.json`, but only into a fresh table (no rows and no number ever issued), so redeploys never duplicate data or reuse numbers.

## Deployment

### Deploying on Upsun

The repository ships an Upsun configuration in `.upsun/config.yaml`: a Node.js application running the Express server, a PostgreSQL service exposed through the `database` relationship, and a deploy hook that runs the migration and then the seed. To deploy it, create a project and push:

```
upsun project:create
upsun push
```

Alternatively, connect the GitHub repository to your Upsun project so that every push is deployed automatically.

## Local Development

1. install dependencies:

```
npm install
```

2. point `DATABASE_URL` at a PostgreSQL database (create it first, e.g. with `createdb techradar`):

```
export DATABASE_URL=postgres://user:password@localhost:5432/techradar
```

3. create the schema and load the seed data (both commands are safe to re-run):

```
npm run migrate
npm run seed
```

4. start the server (set `PORT` to change the default port):

```
npm start
```

5. open the radar in your browser:

```
http://localhost:3000/
```

Run the tests and the linter with:

```
npm test
npm run lint
```

## License

```
The MIT License (MIT)

Copyright (c) 2017-2025 Zalando SE

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
