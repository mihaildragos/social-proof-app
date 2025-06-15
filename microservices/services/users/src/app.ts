import express from "express";
import cors from "cors";
import { authRoutes } from "./routes/authRoutes";
import { profileRoutes } from "./routes/profileRoutes";
import { organizationRoutes } from "./routes/organizationRoutes";
import { teamRoutes } from "./routes/teamRoutes";
import { invitationRoutes } from "./routes/invitationRoutes";
import webhookRoutes from "./routes/webhooks";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/webhooks", webhookRoutes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", service: "users" });
});

export { app };
