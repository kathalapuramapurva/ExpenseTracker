const express = require("express");
const cors = require("cors");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "expenseTracker.db");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server is running at http://localhost:3001");
    });
  } catch (e) {
    console.log(`Error: '${e.message}'`);
    process.exit(1);
  }
};
initializeDbAndServer();
app.use(cors());
app.use(express.json());

const isValidPassword = (password) => {
  return password.length >= 6;
};

//API for 
app.post("/register/", async (request, response) => {

  const { name, email, password, phone, accountNumber, accountName, balance } = request.body;
  const checkUserPresenceQuery = `
      SELECT *
      FROM users
      WHERE email = '${email}';`;
  const dbUser = await db.get(checkUserPresenceQuery);
  if (dbUser === undefined) {
    if (isValidPassword(password)) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
              INSERT INTO 
              users(name,email,password,phone)
              VALUES (
                  '${name}',
                  '${email}',
                  '${hashedPassword}',
                  '${phone}'
              );`;
      await db.run(createUserQuery);
      const userIdQuery = `SELECT last_insert_rowid() as userId;`;
      const userIdResult = await db.get(userIdQuery);
      const { userId } = userIdResult;
      const addAccountQuery = `
    INSERT INTO 
    accounts(account_no,account_name,balance,uid)
    VALUES(
      '${accountNumber}',
      '${accountName}',
      '${balance}',
      ${userId}
    );`;
      await db.run(addAccountQuery);
      const accountIdQuery = `SELECT last_insert_rowid() as accountId;`;
      const accountIdResult = await db.get(accountIdQuery);
      const { accountId } = accountIdResult;
      const addHasQuery = `
        INSERT INTO 
        has(uid,a_id)
        VALUES(
          ${userId},
          ${accountId}
        );`;
      await db.run(addHasQuery);
      response.status(200);
      response.send("User created successfully");

    } else {
      response.status(400);
      response.send({error_msg:"Password is too short"});
    }
  } else {
    response.status(400);
    response.send({error_msg:"User already exists"});
  }
});

//API login
app.post("/login/", async (request, response) => {
  const { email, password } = request.body;

  const checkUserPresence = `
      SELECT *
      FROM users
      WHERE email = '${email}';`;
  const dbUser = await db.get(checkUserPresence);
  if (dbUser === undefined) {
    response.status(400);
    response.send({error_msg:"Invalid User"});
  } else {
    const isValidPassword = await bcrypt.compare(password, dbUser.password);
    if (isValidPassword) {
      const payload = { email };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send({error_msg:"Invalid password"});
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.email = payload.email;
        next();
      }
    });
  }
};


//API account post 
// app.post("/users/account/", authenticateToken, async (request, response) => {
//   const { email } = request;
//   const getUserIdQuery = `
//     SELECT *
//     FROM users 
//     WHERE email = '${email}';`;
//   const { uid } = await db.get(getUserIdQuery);
//   const { account_no, account_name, balance } = request.body;
//   //let current_date = format(new Date(), "yyyy-MM-dd HH:mm:ss");
//   //const newQuery = `
//   // SELECT *
//   // FROM tweet;`;
//   // const newResponse = await db.all(newQuery);
//   // let new_id = newResponse.length + 1;
//   const addAccountQuery = `
//     INSERT INTO 
//     accounts(account_no,account_name,balance,uid)
//     VALUES(
//       '${account_no}',
//       '${account_name}',
//       '${balance}',
//       ${uid}
//     );`;
//   await db.run(addAccountQuery);

//   const accountIdQuery = `SELECT last_insert_rowid() as accountId;`;
//   const accountIdResult = await db.get(accountIdQuery);
//   const { accountId } = accountIdResult;
//   const addHasQuery = `
//     INSERT INTO 
//     has(uid,a_id)
//     VALUES(
//       ${uid},
//       ${accountId}
//     );`;
//   await db.run(addHasQuery);
//   response.send("Created a Account");
// });

//API users get

app.get("/users/details/", authenticateToken, async (request, response) => {
  const { email } = request;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);
  const getUsersDetailsQuery = `
    SELECT *
    FROM users
    WHERE uid = '${uid}';`;

  const dbResponse = await db.all(getUsersDetailsQuery);
  response.send(dbResponse);
});

//API account get

app.get("/users/account/", authenticateToken, async (request, response) => {
  const { email } = request;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);
  const getHaIdQuery = `
    SELECT *
    FROM has
    WHERE uid = '${uid}';`;
  const { a_id } = await db.get(getHaIdQuery);
  const getAllAccountDetailsQuery = `
      SELECT *
      FROM accounts
      WHERE a_id = '${a_id}';`;
  const dbResponse = await db.all(getAllAccountDetailsQuery);
  response.send(dbResponse);
});

//API transactions post 
app.post("/users/transactions/", authenticateToken, async (request, response) => {
  const { email } = request;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);
  const getHasIdQuery = `
    SELECT *
    FROM has
    WHERE uid = '${uid}';`;
  const { a_id } = await db.get(getHasIdQuery);
  const { category, amount, description, type } = request.body;
  //let current_date = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  //const newQuery = `
  // SELECT *
  // FROM tweet;`;
  // const newResponse = await db.all(newQuery);
  // let new_id = newResponse.length + 1;
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0]; // HH:MM:SS
  const addTransactionQuery = `
    INSERT INTO 
    transactions(a_id,date,time,category,amount,description,type)
    VALUES(
        ${a_id},
       '${date}',
       '${time}',
        '${category}',
        '${amount}',
        '${description}',
        '${type}'
    );`;
  await db.run(addTransactionQuery);
  response.send("Added a Transaction");
});

//API transactions income get
app.get("/users/transactions/income", authenticateToken, async (request, response) => {
  const { email } = request;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);
  const getHasIdQuery = `
    SELECT *
    FROM has
    WHERE uid = '${uid}';`;
  const { a_id } = await db.get(getHasIdQuery);
  const getAllTransactionsDetailsQuery = `
      SELECT *
      FROM transactions 
      WHERE a_id = '${a_id}' and type='income' 
      ORDER BY t_id DESC;`;
  const dbResponse = await db.all(getAllTransactionsDetailsQuery);
  response.send(dbResponse);
});


//API transactions expense get
app.get("/users/transactions/expense", authenticateToken, async (request, response) => {
  const { email } = request;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);
  const getHasIdQuery = `
    SELECT *
    FROM has
    WHERE uid = '${uid}';`;
  const { a_id } = await db.get(getHasIdQuery);
  const getAllTransactionsDetailsQuery = `
      SELECT *
      FROM transactions 
      WHERE a_id = '${a_id}' and type='expense'
      ORDER BY t_id DESC;`;
  const dbResponse = await db.all(getAllTransactionsDetailsQuery);
  response.send(dbResponse);
});

//API transactions delete
app.delete(
  "/users/transactions/:id/",
  authenticateToken,
  async (request, response) => {
    const { id } = request.params;
    const isOwnRecurringQuery = `
      SELECT *
      FROM transactions
      WHERE t_id = ${id};`;
    const dbResponse = await db.get(isOwnRecurringQuery);
    if (dbResponse === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteQuery = `
          DELETE FROM transactions 
          WHERE t_id = ${id};`;
      await db.run(deleteQuery);
      response.send("transaction Removed");
    }
  }
);


//API recurring post 
app.post("/users/recurring/", authenticateToken, async (request, response) => {
  const { email } = request;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);

  const { date, category, description, amount } = request.body;

  const addRecurringQuery = `
    INSERT INTO 
    recurring(uid,date,category,description,amount)
    VALUES(
        ${uid},
       '${date}',
        '${category}',
        '${description}',
        '${amount}'
    );`;
  await db.run(addRecurringQuery);
  response.send("Added a Recurring Transaction");
});

//API recurring get

app.get("/users/recurring/", authenticateToken, async (request, response) => {
  const { email } = request;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);
  const getAllRecurringQuery = `
      SELECT *
      FROM recurring 
      WHERE uid = '${uid}'
      ORDER BY r_id DESC;`;
  const dbResponse = await db.all(getAllRecurringQuery);
  response.send(dbResponse);
});

//API recurring put
app.put("/users/recurring/:id/", authenticateToken, async (request, response) => {
  const { email } = request;
  const { id } = request.params;
  const { date, amount } = request.body;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);
  const updateRecurringQuery = `
    UPDATE recurring
    SET date = '${date}', amount = '${amount}'
    WHERE r_id = '${id}';`;

  await db.run(updateRecurringQuery);

  response.send("Updated the Recurring Transaction");
});

//API recurring delete
app.delete(
  "/users/recurring/:id/",
  authenticateToken,
  async (request, response) => {
    const { email } = request;
    const { id } = request.params;
    const isOwnRecurringQuery = `
      SELECT *
      FROM recurring
      WHERE r_id = ${id};`;
    const dbResponse = await db.get(isOwnRecurringQuery);
    if (dbResponse === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteQuery = `
          DELETE FROM recurring 
          WHERE r_id = ${id};`;
      await db.run(deleteQuery);
      response.send("Recurring transaction Removed");
    }
  }
);

//API budget post 
app.post("/users/budget/", authenticateToken, async (request, response) => {
  const { email } = request;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);

  const { category, description, amount } = request.body;

  const addBudgetQuery = `
    INSERT INTO 
    budget(uid,category,description,amount)
    VALUES(
        ${uid},
        '${category}',
        '${description}',
        '${amount}'
    );`;
  await db.run(addBudgetQuery);
  response.send("Added a budget Transaction");
});


//API budget get

app.get("/users/budget/", authenticateToken, async (request, response) => {
  const { email } = request;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);
  const getAllBudgetQuery = `
      SELECT *
      FROM budget 
      WHERE uid = '${uid}'
      ORDER BY b_id DESC;`;
  const dbResponse = await db.all(getAllBudgetQuery);
  response.send(dbResponse);
});


//API budget put
app.put("/users/budget/:id/", authenticateToken, async (request, response) => {
  const { email } = request;
  const { id } = request.params;
  const { date, amount } = request.body;
  const getUserIdQuery = `
    SELECT *
    FROM users 
    WHERE email = '${email}';`;
  const { uid } = await db.get(getUserIdQuery);
  const updateBudgetQuery = `
    UPDATE budget
    SET amount = '${amount}'
    WHERE b_id = '${id}';`;

  await db.run(updateBudgetQuery);

  response.send("Updated the budget Transaction");
});

//API budget delete
app.delete(
  "/users/budget/:id/",
  authenticateToken,
  async (request, response) => {
    const { email } = request;
    const { id } = request.params;
    const isOwnBudgetQuery = `
      SELECT *
      FROM budget
      WHERE b_id = ${id};`;
    const dbResponse = await db.get(isOwnBudgetQuery);
    if (dbResponse === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteQuery = `
          DELETE FROM budget 
          WHERE b_id = ${id};`;
      await db.run(deleteQuery);
      response.send("Budget Removed");
    }
  }
);

module.exports = app;