const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Client } = require('pg');

exports.handler = async (event) => {
  console.log('Starting database initialization...');
  
  try {
    // Get database credentials from Secrets Manager
    const secretsManager = new SecretsManagerClient();
    const secretResult = await secretsManager.send(
      new GetSecretValueCommand({
        SecretId: process.env.DB_SECRET_ARN,
      })
    );
    
    const secretData = JSON.parse(secretResult.SecretString);
    
    // Get initialization SQL from S3
    const s3 = new S3Client();
    const s3Result = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.INIT_SQL_BUCKET,
        Key: process.env.INIT_SQL_KEY,
      })
    );
    
    const sqlContent = await streamToString(s3Result.Body);
    
    // Connect to the database
    const client = new Client({
      host: secretData.host,
      port: secretData.port,
      database: secretData.dbname,
      user: secretData.username,
      password: secretData.password,
      ssl: {
        rejectUnauthorized: false,
      },
    });
    
    await client.connect();
    console.log('Connected to database');
    
    // Execute the initialization SQL
    console.log('Executing initialization SQL...');
    await client.query(sqlContent);
    console.log('SQL executed successfully');
    
    // Check if RLS is enabled
    const rlsResult = await client.query("SHOW row_security");
    console.log(`Row Level Security is: ${rlsResult.rows[0].row_security}`);
    
    // List created tables with RLS
    const rlsTablesResult = await client.query(
      "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public', 'auth') ORDER BY table_schema, table_name"
    );
    console.log('Created tables:');
    for (const row of rlsTablesResult.rows) {
      console.log(`- ${row.table_schema}.${row.table_name}`);
      
      // Check if RLS is enabled for this table
      const tableRlsResult = await client.query(
        `SELECT relrowsecurity FROM pg_class WHERE oid = '${row.table_schema}.${row.table_name}'::regclass`
      );
      
      if (tableRlsResult.rows.length > 0) {
        console.log(`  RLS Enabled: ${tableRlsResult.rows[0].relrowsecurity}`);
      }
    }
    
    // Close the connection
    await client.end();
    console.log('Database initialization completed successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Database initialized successfully with RLS policies',
      }),
    };
  } catch (error) {
    console.error('Error initializing database:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error initializing database',
        error: error.message,
      }),
    };
  }
};

// Helper function to convert stream to string
const streamToString = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}; 