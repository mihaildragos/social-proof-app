import express from "express";
import { Pool } from "pg";
import { config } from "../config";

const router = express.Router();

// Database connection
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  ssl: config.database.ssl,
  max: config.database.max,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
});

/**
 * POST /api/templates/create-default
 * Create a default notification template for a test site
 */
router.post("/create-default", async (req, res) => {
  try {
    const { site_id, site_name, site_domain, owner_id } = req.body;

    if (!site_id) {
      return res.status(400).json({
        error: "site_id is required",
      });
    }

    console.log(`Creating default template for site: ${site_id}`);

    const client = await pool.connect();

    try {
      // First, ensure the site exists in the notifications database
      // Check if site already exists
      const siteCheck = await client.query(
        "SELECT id FROM sites WHERE id = $1",
        [site_id]
      );

      if (siteCheck.rows.length === 0) {
        // Site doesn't exist, create it
        console.log(`Site ${site_id} doesn't exist in notifications DB, creating it...`);
        
        await client.query(
          `INSERT INTO sites (id, owner_id, name, domain, verified_at, settings, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), $5, NOW(), NOW())`,
          [
            site_id,
            owner_id || "00000000-0000-0000-0000-000000000000", // Default if not provided
            site_name || "Test Site",
            site_domain || `test-site-${site_id.slice(-8)}.example.com`,
            JSON.stringify({ is_test_site: true, created_by_notifications_service: true })
          ]
        );
        
        console.log(`✅ Site ${site_id} created in notifications database`);
      } else {
        console.log(`✅ Site ${site_id} already exists in notifications database`);
      }

      // Now call the function to create the default template
      const result = await client.query(
        "SELECT add_default_template_for_test_site($1) as template_id",
        [site_id]
      );

      const templateId = result.rows[0]?.template_id;

      if (!templateId) {
        throw new Error("Failed to create template - no ID returned");
      }

      console.log(`✅ Default template created with ID: ${templateId}`);

      res.json({
        success: true,
        template_id: templateId,
        message: "Default template created successfully",
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error creating default template:", error);
    res.status(500).json({
      error: "Failed to create default template",
      details: error.message,
    });
  }
});

/**
 * GET /api/templates/:site_id
 * Get all templates for a site
 */
router.get("/:site_id", async (req, res) => {
  try {
    const { site_id } = req.params;

    const client = await pool.connect();

    try {
      const result = await client.query(
        "SELECT * FROM templates WHERE site_id = $1 ORDER BY created_at DESC",
        [site_id]
      );

      res.json({
        success: true,
        templates: result.rows,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error fetching templates:", error);
    res.status(500).json({
      error: "Failed to fetch templates",
      details: error.message,
    });
  }
});

export default router;
