import jwt from "jsonwebtoken";

/**
 * Create JWT
 */
export const signToken = (userId: string) =>
  jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

/**
 * Verify JWT
 */
export const verifyToken = (token: string) => {
  return jwt.verify(token, process.env.JWT_SECRET!) as {
    userId: string;
  };
};
