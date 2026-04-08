import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";
import { signToken } from "../auth.js";


const router = Router();

/**
 * POST /auth/register
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    // check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    // create JWT
    const token = signToken(user.id);

    // send token
    res.status(201).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
