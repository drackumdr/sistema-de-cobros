import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!accessKey) {
    console.log("No AWS keys.");
    return;
  }

  const client = new DynamoDBClient({
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    }
  });

  const docClient = DynamoDBDocumentClient.from(client);

  try {
    const table = "ThunderShieldBackend-SecurityTable";
    const info = await client.send(new DescribeTableCommand({ TableName: table }));
    console.log("=== Key Schema ===");
    console.log(JSON.stringify(info.Table?.KeySchema, null, 2));

    const scan = await docClient.send(new ScanCommand({ TableName: table, Limit: 2 }));
    console.log("=== Scan Sample ===");
    console.log(JSON.stringify(scan.Items, null, 2));
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

run();
