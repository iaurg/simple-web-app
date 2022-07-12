const sqlite3 = require("sqlite3").verbose();
const express = require("express");
const app = express();
const port = 3000;

let db;

app.use(express.json());

app.get("/", function (req, res) {
  res.send({ msg: "Ok" });
});

app.get("/modules/count", function (req, res) {
  db.get("SELECT COUNT(*) AS count FROM slide_module", function (err, row) {
    res.send({ count: row.count });
  });
});

// Task 1: Create a route that accepts an id parameter and returns JSON containing the module
// with that id and it's children modules
app.get("/modules/:id", async function (req, res) {
  const paramId = req.params.id;

  async function getSlideModule(db, id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM slide_module WHERE id = ?`, id, (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  }

  async function getSlidesByModuleId(db, id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM slide WHERE module_id = ?`, id, (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  }

  const slideModule = await getSlideModule(db, paramId);

  const slides = await getSlidesByModuleId(db, slideModule.id);

  const module = {
    ...slideModule,
    slides: new Array(slides),
  };

  res.send({ module });
});

// Task 2: Create a route that accepts a JSON payload of a module and its children, saves
// the module and the children in the database, and finally returns the newly-created
// module's id

app.post("/modules", async function (req, res) {
    const module = req.body;

    async function insertSlideModule(db, name, transition_delay_secs) {
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO slide_module (name, transition_delay_secs) VALUES (?, ?)`,
          [name, transition_delay_secs],
          function (err) {
            if (err) reject(err);
            resolve(this.lastID);
          }
        );
      });
    }

    const moduleId = await insertSlideModule(db, module.name, module.transition_delay_secs);

    const slidesElements = db.prepare('INSERT INTO slide(content, module_id) VALUES (?, ?)')

    module.slides.forEach((slide) => {
        slidesElements.run([slide.content, moduleId]) // can also use `slidesElements.get(...)`, `slidesElements.all(...)`, etc.
    })

    slidesElements.finalize()

    res.send({ id: moduleId });
    }
);

/////////////////////////////////////////////////////////////////
// In-memory DB initialization and start of express server here.
// Candidates should not modify any below.
/////////////////////////////////////////////////////////////////
db = new sqlite3.Database(":memory:");
setTimeout(() => {
  // Why are we using setTimeout? The short answer is because there is because there seems to be a race-condition
  // that results in a segmentation fault during initialization of the db.
  //
  // This is affecting the sqlite3 package version 5.0.7.
  //
  // No combination of callback, event listening seemed to resolve it because the `db` variable isn't ready
  // and the callback doesn't include it's own db variable. So we add a 2-second wait as a workaround.
  db.exec(`
        CREATE TABLE slide_module (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(50),
            transition_delay_secs INTEGER NOT NULL DEFAULT 5
        );

        CREATE TABLE slide (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id INTEGER NOT NULL,
        content TEXT
        );

        INSERT INTO slide_module (name)
        VALUES
        ('Module 1'),
        ('Module 2'),
        ('Module 3'),
        ('Module 4'),
        ('Module 5');

        INSERT INTO slide(module_id, content)
        VALUES
        (1, 'I am Slide 1 of Module 1'),
        (4, 'I am Slide 1 of Module 4'),
        (5, 'I am Slide 1 of Module 5'),
        (4, 'I am Slide 2 of Module 4'),
        (2, 'I am Slide 1 of Module 2'),
        (1, 'I am Slide 2 of Module 1'),
        (1, 'I am Slide 3 of Module 1'),
        (5, 'I am Slide 2 of Module 5'),
        (1, 'I am Slide 4 of Module 1'),
        (5, 'I am Slide 3 of Module 5');`);

  process.on("beforeExit", () => {
    db.close();
  });

  app.listen(port, function () {
    console.log(`Server running on ${port}!`);
  });
}, 2000);
