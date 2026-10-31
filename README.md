# Willow Creek Pet Lodge: concept demo

A concept rebuild of the Willow Creek Pet Lodge website, made by Sean Oplinger for a private pitch to the owners. It is not the official site, and it is set to `noindex` so search engines won't pick it up.

Plain HTML, CSS and vanilla JavaScript. No framework and no build step. Content lives in `content/*.json` and can be edited through a Decap CMS admin at `/admin/`.

## Run it locally

One-time setup, then one command:

```
npm install
npm run demo
```

- Site: http://localhost:8080
- Content editor: http://localhost:8080/admin/ (on localhost it uses the local backend, so no login is needed)

`npm run demo` starts two things: the static site on port 8080 and the Decap local backend on port 8081. Run it from this folder.

## What's in here

| Path | What it is |
| --- | --- |
| `index.html` and the other `.html` pages | Each page is its own file, with relative links so it works under a subpath |
| `content/hours.json` | Front desk, tour, daycare and grooming hours, plus holiday closures. One source, shown on every page |
| `content/announcements.json` | Announcements and coupons. Items hide automatically after `end_date` |
| `content/prices.json` | Price list. Unknown prices say "Ask us" and carry an "owner to fill" tag |
| `content/services.json`, `faqs.json`, `gallery.json` | Service cards, vaccine FAQs, gallery photos |
| `js/site.js` | Loads the JSON and renders hours, "open now", announcements, prices, services, FAQs and gallery |
| `js/reserve.js` | The reservation form: validation, pet cards, 48-hour warning, staff-text preview |
| `admin/` | Decap CMS (`config.yml` defines the editable fields) |
| `images/` | Placeholder photos in 640 and 1200 px WebP, plus `uploads/` for new images |

## Deploy to GitHub Pages later

1. Create a GitHub repo named `willow-creek-demo` (or any name). Push this folder to its `main` branch.
2. In `admin/config.yml`, set `repo:` to `YOUR-USERNAME/willow-creek-demo`.
3. In the repo: Settings > Pages > Build and deployment > Deploy from a branch > `main` / `(root)`.
4. The site will be at `https://YOUR-USERNAME.github.io/willow-creek-demo/`. Every link is relative, so this works. `.nojekyll` is included.
5. Keep `noindex` and `robots.txt` in place until the owners approve the launch.

## Let the owners log in to /admin on the live site

On the live site, Decap needs GitHub login through an OAuth proxy. A free Cloudflare Worker works:

1. On GitHub, create an OAuth App (Settings > Developer settings > OAuth Apps). Set the callback URL to `https://YOUR-WORKER.workers.dev/callback`.
2. Deploy an OAuth proxy Worker. The `sterlingwes/decap-proxy` repo is a common choice. Follow its README to deploy with Wrangler, and set the secrets `GITHUB_OAUTH_ID` and `GITHUB_OAUTH_SECRET` to the OAuth App's values.
3. In `admin/config.yml`, replace `https://YOUR-OAUTH-PROXY.workers.dev` with your Worker's URL.
4. Give the owners write access to the repo, or invite them as collaborators.

Local editing with `npm run demo` doesn't need any of this.

## Copyright and content

- Every sentence on these pages was written fresh for this demo. Nothing is copied from the current site.
- The photos are AI-generated placeholders. They are not the owners' photos. Swap in real photos only after the owners hire Sean.
- Facts (address, phone, hours, rates, vaccine rules) come from the current site. The owners need to confirm them before launch.
- "Ask us" and the "owner to fill" tag mark everything the owners still need to supply.

## Pitch demo script

1. Open http://localhost:8080 on a phone-sized window (or dev tools in mobile view). Show the banner, the hero, and the "Call" and "Text us" buttons.
2. Point to the header's "Front desk right now" indicator. It uses New York time and shows open or closed.
3. Scroll to "Happening now". The active "Book holiday stays early" item shows, and the expired 5%-off coupon is hidden.
4. Go to Reserve online. Set check-in to tomorrow to show the 48-hour records warning. Add a second pet, pick a dog activity, submit, and show the staff-text preview. Point out that "Demo only, nothing was sent" is shown.
5. Go to Pricing. Show the clear "Ask us" items with the "owner to fill" tags.
6. Open http://localhost:8080/admin/. Edit an announcement's end date to yesterday, save, then refresh the home page. The item disappears with no code change.
7. In admin, change a front desk closing time, then refresh the home, contact and footer. The change shows up everywhere because all pages read `hours.json`.

## Limitations

- Nothing is sent. The reservation form only previews the staff text. A live version needs a backend and an SMS provider (for example, Twilio) to send texts and store files privately.
- The "Text us" buttons use the placeholder `sms:+10000000000`. Replace it with the real Twilio number (search for `+10000000000`).
- Holiday closures are listed by date. Add new years' holidays in the CMS. Past dates are hidden automatically.
- The fallback HTML in the footer and on the pages is only shown if JavaScript fails. It matches the current hours, but `hours.json` takes over once the page loads.
- Open questions for the owners: daycare closing time, grooming hours, Saturday tour hours, activity and add-on prices, small pet vaccine rules, Independence Day 2027 hours, and whether our owner is "owner" or "General Manager" (the current site uses both).
- No social links are included. The demo uses a fictional business, so no real social profiles are linked.
- The 404 page uses relative links. On GitHub Pages, links from deep paths may not resolve correctly.
- The reservation form uses the browser's clock for the 48-hour check. It is not tied to the business time zone.
- The gallery and services images are placeholders with alt text written for this demo. Replace them as needed.
