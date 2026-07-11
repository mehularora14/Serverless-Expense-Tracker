import json
import uuid
import boto3
from decimal import Decimal

# Connect to DynamoDB
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("Expenses")


def lambda_handler(event, context):
    try:
        # Read JSON data sent from API
        body = json.loads(event["body"])

        expense = {
            "expenseId": str(uuid.uuid4()),
            "title": body["title"],
            "amount": Decimal(str(body["amount"])),
            "category": body["category"],
            "date": body["date"],
            "month": body["month"],
            "notes": body.get("notes", "")
        }

        # Save to DynamoDB
        table.put_item(Item=expense)

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "message": "Expense added successfully!",
                "expenseId": expense["expenseId"]
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "error": str(e)
            })
        }
