# Daria Godorozha - personal site

A single-page academic site for GitHub Pages: bio and education, research,
teaching and hackathons, with a geometry theme built around one idea. The hero
is the Hopf fibration: every point of the ordinary sphere lifts to a circle
in the three-sphere, and the circles over one line of latitude fill a torus.
Three latitudes give three linked tori, projected stereographically and drawn
as hairlines in the three gradients. One slider moves the latitudes and a
second sets the size, letting the figure grow past its box and draw behind the
rest of the page; it turns on its own, can be dragged, flung or steered with the
arrow keys, and the fibres drift around their tori when left alone. The colours follow three gradient-painted
statues: the Winged Victory (coral to yellow, for positive curvature), David
(sky to cobalt, for zero) and the Thinker (mint to teal, for negative).

Everything is static: one HTML file, a stylesheet, two small scripts, five font
files (DM Sans and DM Mono, both under the SIL Open Font Licence) and a few
images. No build step, framework, tracker or third-party request.

```
dg-site/
├── index.html          The page
├── css/style.css
├── js/hopf.js          The Hopf fibration
├── js/site.js          Menu, slider, pause control, keyboard, section highlighting
├── fonts/              DM Sans (variable) and DM Mono, with licences
├── img/                Fallback still, Open Graph image, icons
├── favicon.svg
├── .nojekyll           Tells GitHub Pages to serve the files as they are
└── tools/              Screenshot and image-generation helpers (not needed for deployment)
```

## Publish on GitHub Pages

1. Create a new repository on GitHub named `<your-username>.github.io`
   (public). If you would rather keep it under another name, the site will be
   served at `https://<your-username>.github.io/<repository>/` instead; the
   relative links in the page work either way.
2. Put the contents of this folder at the root of the repository (so
   `index.html` sits at the top level, not inside a subfolder) and push to the
   `main` branch. From a terminal in the folder:

   ```
   git init
   git add .
   git commit -m "Personal site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-username>.github.io.git
   git push -u origin main
   ```

3. In the repository, open *Settings > Pages*. Under *Build and deployment*
   choose *Deploy from a branch*, select `main` and `/ (root)`, and save.
4. The site appears at `https://<your-username>.github.io/` within a minute or
   two, and every later push republishes it.

The `.nojekyll` file matters: without it GitHub runs the files through Jekyll,
which ignores anything beginning with an underscore and adds nothing useful
here.

## Things to fill in

- **Links.** The GitHub link in the footer points at github.com/dgodorozha;
  replace the LinkedIn link with your profile URL, or delete it.
- **Open Graph image.** `og:image` and `og:url` already point at
  `https://dgodorozha.github.io/`; change them if the site is served from
  another address.
- **Email.** Both addresses from the CV are shown; remove one if you prefer to
  publish only one.
- **Content.** Everything is in `index.html` in plain HTML; each section is
  marked with a comment (`01` to `04`).

## Preview locally

```
python3 -m http.server 8080
```

from inside the folder, then open <http://localhost:8080/>. Double-clicking
`index.html` also works, though some browsers will substitute a system typeface
for the self-hosted fonts.

## The figure

`js/hopf.js` exposes one global:

```js
const h = Hopf.mount(canvas, {
  eta: 0.87,              // latitude parameter of the middle torus, 0.62 to 1.12
  autoRotate: true,       // slow turn
  idle: true,             // the fibres drift around their tori
  onChange: eta => {}     // reports eta for the readout
});
h.setEta(0.9); h.pause(); h.play(); h.nudge(dyaw, dpitch); h.destroy();
```

It stops drawing when scrolled out of view, honours `prefers-reduced-motion`
(a still frame, draggable, with the pause button starting in its paused state),
and shows `img/hopf-still.png` when JavaScript is off.

## Regenerating the images

With Python 3, `playwright` and `Pillow` installed:

```
cd tools
python3 shoot.py "file://$PWD/still.html" ../img/hopf-still.png --w 660 --h 540 --el '#c' --alpha
python3 shoot.py "file://$PWD/still.html" ../img/hopf-still@2x.png --w 660 --h 540 --el '#c' --alpha --scale 2
python3 shoot.py "file://$PWD/og.html" ../img/og.png --w 1200 --h 630
python3 -c "from mark import svg; open('../favicon.svg','w').write(svg(64,1.5,(0.3,0.6),fib=10,seg=110,pad=0.08,bg='#16181d',radius=14,delta=0.12))"   # the mark: see tools/mark.py
```
