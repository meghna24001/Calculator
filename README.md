# Calyx

Calyx is a browser-based calculator for everyday arithmetic and more advanced problems. It brings basic and scientific calculations, unit conversions, and interactive graphing together in one responsive app.

The project is built with HTML, CSS, and JavaScript, with no application package dependencies. It can also be installed as a Progressive Web App (PWA), so its main assets can be used offline after they have been cached.

## What it can do

- **Basic and scientific calculations**, including common functions, percentages, fractions, and calculation history.
- **Step-by-step working** to make calculations easier to follow.
- **Unit conversion** across categories such as length, temperature, speed, volume, and data storage.
- **2D graphing** for plotting functions, exploring the graph, and viewing a table of values.
- **Personalization** with light and dark themes, accent colors, and a responsive layout.
- **PWA support**, including installation and offline caching.

Use the menu in the app to switch between calculator modes. You can also open a mode directly with a URL, for example `index.html?mode=scientific` or `index.html?mode=converter`.

## Run the app

You’ll need [Node.js](https://nodejs.org/) to use the included development server. From the project folder, run:

```sh
node server.js
```

Then open [http://127.0.0.1:3000/](http://127.0.0.1:3000/) in your browser.

Alternatively, serve the project directory with another local static server. Service worker installation and offline caching require the app to be served from `localhost` or a secure HTTPS connection; opening `index.html` directly from the file system does not provide those features.

## Run the tests

The test scripts use Node.js and can be run from the project folder:

```sh
node js/test-parser.js
node js/test-converter.js
node js/test-grapher.js
```

There is also a browser end-to-end test:

```sh
node js/browser-e2e.js
```

The end-to-end test expects a compatible Chrome browser with its DevTools Protocol endpoint available.

## Project structure

```text
├── index.html               # Main application page
├── basic.html               # Compatibility page that opens basic mode
├── scientific.html          # Compatibility page that opens scientific mode
├── manifest.json            # PWA name, icons, and launch settings
├── sw.js                    # Service worker and offline asset cache
├── server.js                # Local development server
├── css/
│   └── style.css            # Application styles and themes
├── js/
│   ├── app.js               # Interface, calculator state, and mode switching
│   ├── parser.js            # Mathematical expression parsing and evaluation
│   ├── converter.js         # Unit conversion logic
│   ├── grapher.js           # Graph plotting and function analysis
│   ├── test-parser.js       # Parser tests
│   ├── test-converter.js    # Converter tests
│   ├── test-grapher.js      # Grapher tests
│   ├── test-critical-points.js # Additional graph analysis tests
│   ├── browser-e2e.js       # Browser end-to-end test
│   └── capture-themes.js    # Browser utility for capturing themes
└── icons/                   # App icons and favicon
```