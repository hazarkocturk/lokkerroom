import express from "express";
import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/users.js";
import DirectMessage from "../models/directmessage.js";
const router = express.Router();

export const checkUser = (req, res, next) => {
  const token = req.cookies.jsonwebtoken;
  if (token) {
    jwt.verify(
      token,
      process.env.SECRET_KEY_TOKEN,
      async (err, decodedToken) => {
        if (err) {
          console.log(err.message);
          res.locals.user = null;
          next();
        } else {
          const user = await User.findByPk(decodedToken.userId);
          res.locals.user = user;
          next();
        }
      }
    );
  } else {
    res.locals.user = null;
    next();
  }
};

// export const authMiddleware = async (req, res, next) => {
//   try {
//     const token = req.cookies.jsonwebtoken;
//     if (token) {
//       jwt.verify(token, process.env.SECRET_KEY_TOKEN, (err) => {
//         if (err) {
//           console.error(err);
//           res.redirect("login");
//         } else {
//           next();
//         }
//       });
//     } else {
//       res.redirect("login");
//     }
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// };

const failedLoginAttempts = {};

const trackFailedLoginAttempts = async (req, res, next) => {
  const { email } = req.body;

  if (failedLoginAttempts[email] >= 5) {
    return res
      .status(429)
      .json({
        error: "Too many failed login attempts. Please try again later.",
      });
  }
  next();
};

router.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

router.post("/signup", async (req, res) => {
    console.log("Received signup request:", req.body);
    const { email, password, nickname } = req.body;
  
    try {
        if(email==""||password==""||nickname=="") {
            return res.status(400).json({ error: "Fill the inputs" });
        }
      const existingUser = await User.findOne({
        where: { email },
        attributes: ["id", "email", "nickname"],
      });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }
      const existingUsers = await User.findAll({ attributes: ["id"] });
      const existingIds = existingUsers.map((user) => user.id);
      let nextId = 1;
      while (existingIds.includes(nextId)) {
        nextId++;
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        id: nextId,
        email,
        password: hashedPassword,
        nickname,
      });
      res.redirect("login");
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
  

router.get("/login", (req, res) => {
  res.render("login.ejs");
});

router.post("/login", trackFailedLoginAttempts, async (req, res) => {
  const { email, password } = req.body;
  console.log(req.body);
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      if (failedLoginAttempts[email]) {
        failedLoginAttempts[email]++;
      } else {
        failedLoginAttempts[email] = 1;
      }
      return res.status(400).json({ error: "User does not exist" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      if (failedLoginAttempts[email]) {
        failedLoginAttempts[email]++;
      } else {
        failedLoginAttempts[email] = 1;
      }
      return res.status(400).json({ error: "Invalid password" });
    }

    delete failedLoginAttempts[email];

    const token = await jwt.sign(
      { userId: user.id },
      process.env.SECRET_KEY_TOKEN,
      { expiresIn: "1h" }
    );
    res.cookie("jsonwebtoken", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    });
    return res.redirect("/api/dash");
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete", checkUser, async (req, res) => {
  const userId = req.user.id;
  try {
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    await DirectMessage.destroy({ where: { receiverid: userId } });
    await user.destroy();

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});



export default router;
