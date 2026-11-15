# Group Travel Planner — How to Run It

CPAN 324 · Group 3 — Henry Dineros, Han-Pin Hung, Jonathan Pipim, Vedant Patel

**No database server needed.** There is nothing to install, no account to
create, and nothing to configure. All data is saved to a local JSON file inside
the project folder (`server/data.json`). See `README.md` for the full project
overview and `docs/DATA_MODEL.md` for how the data is organised.

---

## Step 1 — Install Node.js (one time)

Go to **https://nodejs.org** and click the big green **LTS** download button.

Run the installer and click Next until it finishes. Accept all the defaults.

**Important:** if VS Code (or any terminal) was already open while you installed
Node, **close it completely and reopen it**. A terminal that was open beforehand
will not know Node exists, and you will get `'npm' is not recognized`.

To check it worked, open a terminal and type `node --version`. You should see
something like `v22.11.0`.

---

## Step 2 — Open the project in VS Code

1. Clone the repository (`git clone https://github.com/HorseshoeJoe/gt-planner.git`)
   or unzip a download of it. A plain folder such as
   `C:\Projects` works best — avoid putting it inside OneDrive, which can lock
   files while npm is installing.
2. Open **VS Code** → **File** → **Open Folder…** → choose the
   **gt-planner** folder (the one containing `client` and `server`).
3. Open the built-in terminal: **Terminal** → **New Terminal**
   (or press `` Ctrl + ` ``).

---

## Step 3 — Type two commands

In that terminal, type this and press Enter:

```
npm install
```

It prints a lot of text for a minute or two. That is normal. Wait until you get
your cursor back.

Then type:

```
npm run dev
```

Wait a few seconds. When you see this, it is running:

```
[SERVER]   Listening on   http://localhost:5000
[CLIENT]   ➜  Local:   http://localhost:5173/
```

---

## Step 4 — Open it in your browser

Go to **http://localhost:5173**

Click **Create account**, register, and start planning a trip.

---

## Optional — Load example data instead

If you would rather see a trip that is already filled in, open a **second**
terminal (**Terminal** → **New Terminal**) and type:

```
npm run seed
```

Then refresh the browser and sign in with:

| Username | Password |
| --- | --- |
| `henry` | `Password123` |
| `hanpin` | `Password123` |
| `chantal` | `Password123` |

`chantal` has a **pending invitation**, so signing in as her and using
**Join a trip** demonstrates the invite flow. The seed command prints the invite
code you need.

---

## What to try

1. **Create a trip** — name, destination, start and end dates.
2. **Members tab** — copy the invite code. Open a private/incognito window,
   register a second account there, click **Join a trip** and paste the code.
   Back in the first window the member flips from *Invite pending* to *Joined*.
3. **Itinerary tab** — add activities to a day. Try adding one that overlaps a
   time you already used: it warns you and tells you exactly what it clashes with.
4. **Attractions / Restaurants / Transport tabs** — add, edit and delete entries.
5. **Budget tab** — add expenses and watch the totals, category bars and
   per-member balances update straight away. Try the **Split evenly** button.
6. **View full itinerary** — the whole trip laid out in order, with a
   print / save-as-PDF button.

---

## Where the data is kept

Everything is saved in **`server/data.json`**. You can open that file in VS Code
and read it.

- To **start over with an empty app**, delete that file (or run `npm run reset`).
- To **reload the example trip**, run `npm run seed`.
- Nothing is sent anywhere. The app runs entirely on your own computer.

---

## Stopping and restarting

- **Stop:** click the terminal and press `Ctrl + C`.
- **Start again later:** open the terminal in the same folder and type
  `npm run dev`. You only ever do Step 1 and `npm install` once.

---

## Running the automated tests (optional)

```
npm test
```

About 100 tests: the API, the primary user flow, schedule-conflict rules, budget
maths, the data store and the POI dataset on the server, plus the forms and
dialogs in the browser. Results are recorded in `docs/TESTING.md`.
