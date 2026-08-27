export {};

declare global {
  interface CustomJwtSessionClaims {
    role?: "admin" | "renter";
  }
}
